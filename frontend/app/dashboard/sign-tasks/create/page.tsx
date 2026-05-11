"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { getToken } from "../../../../lib/auth";
import {
    createSignTask,
    updateSignTask,
    getSignTask,
    listAccounts,
    getAccountChats,
    searchAccountChats,
    testSendMessage,
    AccountInfo,
    ChatInfo,
    SignTaskChat,
} from "../../../../lib/api";
import {
    CaretLeft,
    Plus,
    X,
    ChatCircleText,
    Trash,
    Spinner,
    Lightning,
    Check
} from "@phosphor-icons/react";
import { ThemeLanguageToggle } from "../../../../components/ThemeLanguageToggle";
import { useLanguage } from "../../../../context/LanguageContext";
import { ToastContainer, useToast } from "../../../../components/ui/toast";

const DICE_OPTIONS = ["🎲", "🎯", "🏀", "⚽", "🎳", "🎰"];

const ACTION_TYPES = [
    { value: 1, labelKey: "action_send_text" },
    { value: 2, labelKey: "action_send_dice" },
    { value: 3, labelKey: "action_click_button" },
    { value: 4, labelKey: "action_ai_vision_click" },
    { value: 5, labelKey: "action_ai_logic_send" },
    { value: 6, labelKey: "action_ai_vision_send" },
    { value: 7, labelKey: "action_ai_logic_click" },
    { value: 8, labelKey: "keyword_monitor" },
];

const defaultActionData = (actionType: number): any => {
    switch (actionType) {
        case 2: return { action: 2, dice: "🎲" };
        case 3: return { action: 3, text: "" };
        case 4: return { action: 4, question: "" };
        case 5: return { action: 5 };
        case 6: return { action: 6 };
        case 7: return { action: 7 };
        case 8: return { action: 8, keywords: [], match_mode: "contains", ignore_case: true, push_channel: "telegram" };
        default: return { action: 1, text: "" };
    }
};

function CreateSignTaskContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editName = searchParams.get("edit") || "";
    const editAccount = searchParams.get("account") || "";
    const isEditing = !!editName;

    const { t } = useLanguage();
    const { toasts, addToast, removeToast } = useToast();
    const [token, setLocalToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingTask, setLoadingTask] = useState(false);

    // 表单数据
    const [taskName, setTaskName] = useState("");
    const [executionMode, setExecutionMode] = useState<"fixed" | "range">("range");
    const [signAt, setSignAt] = useState("0 6 * * *");
    const [rangeStart, setRangeStart] = useState("09:00");
    const [rangeEnd, setRangeEnd] = useState("18:00");
    const [randomSeconds, setRandomSeconds] = useState(0);
    const [signInterval, setSignInterval] = useState(1);
    const [chats, setChats] = useState<SignTaskChat[]>([]);

    // 账号和 Chat 数据
    const [accounts, setAccounts] = useState<AccountInfo[]>([]);
    const [selectedAccount, setSelectedAccount] = useState("");
    const [availableChats, setAvailableChats] = useState<ChatInfo[]>([]);
    const [chatSearch, setChatSearch] = useState("");
    const [chatSearchResults, setChatSearchResults] = useState<ChatInfo[]>([]);
    const [chatSearchLoading, setChatSearchLoading] = useState(false);

    // 测试发送
    const [testText, setTestText] = useState("/checkin");
    const [testSending, setTestSending] = useState(false);

    // 用 ref 稳定回调，避免 addToast/t 变化时触发 useEffect 无限重跑
    const addToastRef = useRef(addToast);
    const tRef = useRef(t);
    const routerRef = useRef(router);
    useEffect(() => {
        addToastRef.current = addToast;
        tRef.current = t;
        routerRef.current = router;
    }, [addToast, t, router]);

    const formatErrorMessage = useCallback((key: string, err?: any) => {
        const base = tRef.current(key);
        const code = err?.code;
        return code ? `${base} (${code})` : base;
    }, []);

    const handleAccountSessionInvalid = useCallback((err: any) => {
        if (err?.code !== "ACCOUNT_SESSION_INVALID") return false;
        addToastRef.current(tRef.current("account_session_invalid"), "error");
        setTimeout(() => routerRef.current.replace("/dashboard"), 800);
        return true;
    }, []);

    // 当前编辑的 Chat
    const [editingChat, setEditingChat] = useState<{
        chat_id: number;
        name: string;
        actions: any[];
        delete_after?: number;
        action_interval: number;
        message_thread_id?: number;
    } | null>(null);

    const loadChats = useCallback(async (tokenStr: string, accountName: string) => {
        try {
            const chatsData = await getAccountChats(tokenStr, accountName);
            setAvailableChats(chatsData);
        } catch (err: any) {
            if (handleAccountSessionInvalid(err)) return;
            console.error("加载 Chat 失败:", err);
        }
    }, [handleAccountSessionInvalid]);

    const loadAccounts = useCallback(async (tokenStr: string, defaultAccount?: string) => {
        try {
            const data = await listAccounts(tokenStr);
            setAccounts(data.accounts);
            const account = defaultAccount || (data.accounts.length > 0 ? data.accounts[0].name : "");
            if (account) {
                setSelectedAccount(account);
                loadChats(tokenStr, account);
            }
        } catch (err: any) {
            addToastRef.current(formatErrorMessage("load_failed", err), "error");
        }
    }, [loadChats, formatErrorMessage]);

    // 编辑模式：加载现有任务数据
    const loadExistingTask = useCallback(async (tokenStr: string, name: string, account: string) => {
        if (!name || !account) return;
        setLoadingTask(true);
        try {
            const task = await getSignTask(tokenStr, name, account);
            setTaskName(task.name);
            setSelectedAccount(task.account_name);
            setExecutionMode(task.execution_mode || "range");
            setSignAt(task.sign_at || "0 6 * * *");
            setRangeStart(task.range_start || "09:00");
            setRangeEnd(task.range_end || "18:00");
            setRandomSeconds(task.random_seconds || 0);
            setSignInterval(task.sign_interval || 1);
            setChats(task.chats || []);
            await loadChats(tokenStr, task.account_name);
        } catch (err: any) {
            addToastRef.current(formatErrorMessage("load_failed", err), "error");
        } finally {
            setLoadingTask(false);
        }
    }, [loadChats, formatErrorMessage]);

    // 仅在挂载时执行一次初始化，避免 addToast/t 引用变化导致无限重跑
    useEffect(() => {
        const tokenStr = getToken();
        if (!tokenStr) { routerRef.current.replace("/"); return; }
        setLocalToken(tokenStr);
        const editing = !!searchParams.get("edit");
        const eName = searchParams.get("edit") || "";
        const eAcc = searchParams.get("account") || "";
        if (editing) {
            loadAccounts(tokenStr, eAcc);
            loadExistingTask(tokenStr, eName, eAcc);
        } else {
            loadAccounts(tokenStr);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAccountChange = (accountName: string) => {
        setSelectedAccount(accountName);
        if (token) loadChats(token, accountName);
    };

    useEffect(() => {
        if (!token || !selectedAccount) return;
        const query = chatSearch.trim();
        if (!query) {
            setChatSearchResults([]);
            setChatSearchLoading(false);
            return;
        }
        let cancelled = false;
        setChatSearchLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res = await searchAccountChats(token, selectedAccount, query, 50, 0);
                if (!cancelled) setChatSearchResults(res.items || []);
            } catch (err: any) {
                if (!cancelled) {
                    if (handleAccountSessionInvalid(err)) return;
                    addToastRef.current(formatErrorMessage("search_failed", err), "error");
                    setChatSearchResults([]);
                }
            } finally {
                if (!cancelled) setChatSearchLoading(false);
            }
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [chatSearch, token, selectedAccount, formatErrorMessage, handleAccountSessionInvalid]);

    useEffect(() => {
        if (!editingChat) {
            setChatSearch("");
            setChatSearchResults([]);
            setChatSearchLoading(false);
            setTestText("/checkin");
            setTestSending(false);
        }
    }, [editingChat]);

    const handleAddChat = () => {
        setEditingChat({ chat_id: 0, name: "", message_thread_id: undefined, actions: [], action_interval: 1 });
    };

    const handleSaveChat = () => {
        if (!editingChat) return;
        if (editingChat.chat_id === 0) { addToastRef.current(tRef.current("select_chat_error"), "error"); return; }
        if (editingChat.actions.length === 0) { addToastRef.current(tRef.current("add_action_error"), "error"); return; }
        const firstActionType = editingChat.actions[0]?.action;
        if (firstActionType !== 1 && firstActionType !== 2) {
            addToastRef.current(tRef.current("first_action_must_be_send"), "error");
            return;
        }
        setChats([...chats, editingChat]);
        setEditingChat(null);
    };

    const handleTestSend = async () => {
        if (!token || !editingChat || editingChat.chat_id === 0) return;
        if (!testText.trim()) return;
        setTestSending(true);
        try {
            await testSendMessage(
                token,
                selectedAccount,
                editingChat.chat_id,
                testText.trim(),
                editingChat.message_thread_id,
            );
            addToastRef.current(tRef.current("test_send_success") || "测试消息已发送", "success");
        } catch (err: any) {
            addToastRef.current(formatErrorMessage("test_send_failed", err) || `发送失败`, "error");
        } finally {
            setTestSending(false);
        }
    };

    const handleSubmit = async () => {
        if (!token) return;
        if (!isEditing && !taskName) { addToastRef.current(tRef.current("task_name_required"), "error"); return; }
        if (executionMode === "fixed" && !signAt) { addToastRef.current(tRef.current("cron_required"), "error"); return; }
        if (executionMode === "range" && (!rangeStart || !rangeEnd)) { addToastRef.current(tRef.current("range_required"), "error"); return; }
        if (chats.length === 0) { addToastRef.current(tRef.current("chat_required"), "error"); return; }

        try {
            setLoading(true);
            if (isEditing) {
                await updateSignTask(token, editName, {
                    sign_at: executionMode === "fixed" ? signAt : "0 0 * * *",
                    chats,
                    random_seconds: randomSeconds,
                    sign_interval: signInterval,
                    execution_mode: executionMode,
                    range_start: rangeStart,
                    range_end: rangeEnd,
                }, editAccount);
                addToastRef.current(tRef.current("save_success") || "保存成功", "success");
            } else {
                await createSignTask(token, {
                    name: taskName,
                    account_name: selectedAccount,
                    sign_at: executionMode === "fixed" ? signAt : "0 0 * * *",
                    chats,
                    random_seconds: randomSeconds,
                    sign_interval: signInterval,
                    execution_mode: executionMode,
                    range_start: rangeStart,
                    range_end: rangeEnd,
                });
                addToastRef.current(tRef.current("create_success"), "success");
            }
            setTimeout(() => routerRef.current.push("/dashboard/sign-tasks"), 1000);
        } catch (err: any) {
            addToastRef.current(formatErrorMessage(isEditing ? "save_failed" : "create_failed", err), "error");
        } finally {
            setLoading(false);
        }
    };

    if (!token) return null;

    return (
        <div id="create-task-view" className="w-full h-full flex flex-col pt-[72px]">
            <nav className="navbar fixed top-0 left-0 right-0 z-50 h-[72px] px-5 md:px-10 flex justify-between items-center glass-panel rounded-none border-x-0 border-t-0 bg-white/2 dark:bg-black/5">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/sign-tasks" className="action-btn" title={t("cancel")}>
                        <CaretLeft weight="bold" />
                    </Link>
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="text-main/40 uppercase tracking-widest text-[10px]">{t("sidebar_tasks")}</span>
                        <span className="text-main/20">/</span>
                        <span className="text-main uppercase tracking-widest text-[10px]">
                            {isEditing ? (t("edit_task") || "编辑任务") : t("add_task")}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <ThemeLanguageToggle />
                </div>
            </nav>

            <main className="flex-1 p-5 md:p-10 w-full max-w-[900px] mx-auto overflow-y-auto animate-float-up pb-20">
                <header className="mb-10">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">
                        {isEditing ? (t("edit_task") || "编辑任务") : t("add_task")}
                    </h1>
                    {isEditing && (
                        <p className="text-[#9496a1] text-sm font-mono">{editName} · {editAccount}</p>
                    )}
                </header>

                {loadingTask ? (
                    <div className="flex items-center justify-center py-20 text-main/30">
                        <Spinner size={32} className="animate-spin" />
                    </div>
                ) : (
                <div className="grid gap-8">
                    {/* 基本配置 */}
                    <section className="glass-panel p-6 space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-[#8a3ffc]/10 rounded-lg text-[#b57dff]">
                                <Lightning weight="fill" size={18} />
                            </div>
                            <h2 className="text-lg font-bold">{t("basic_config")}</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-main/40 uppercase tracking-wider">{t("task_name")}</label>
                                <input
                                    className={`!mb-0 ${isEditing ? "opacity-50 cursor-not-allowed" : ""}`}
                                    value={taskName}
                                    onChange={(e) => !isEditing && setTaskName(e.target.value)}
                                    readOnly={isEditing}
                                    placeholder={t("task_name_placeholder")}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-main/40 uppercase tracking-wider">{t("associated_account")}</label>
                                <select
                                    className={`!mb-0 ${isEditing ? "opacity-50 cursor-not-allowed" : ""}`}
                                    value={selectedAccount}
                                    onChange={(e) => !isEditing && handleAccountChange(e.target.value)}
                                    disabled={isEditing}
                                >
                                    {accounts.map(acc => <option key={acc.name} value={acc.name}>{acc.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* 调度模式 */}
                        <div className="p-4 glass-panel !bg-black/5 space-y-4 border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <label className="text-xs font-bold text-main/40 uppercase tracking-wider">
                                    {t("scheduling_mode")}
                                </label>
                                <div className="text-xs font-bold text-[#8a3ffc] bg-[#8a3ffc]/10 px-2 py-1 rounded">
                                    {t("random_range_default")}
                                </div>
                            </div>
                            <p className="text-xs text-[#9496a1] mb-4">{t("random_range_desc")}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-main/40 uppercase tracking-wider">{t("start_time")}</label>
                                    <input type="time" className="!mb-0" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-main/40 uppercase tracking-wider">{t("end_time")}</label>
                                    <input type="time" className="!mb-0" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Chat 配置 */}
                    <section className="glass-panel p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#8a3ffc]/10 rounded-lg text-[#b57dff]">
                                    <ChatCircleText weight="fill" size={18} />
                                </div>
                                <h2 className="text-lg font-bold">{t("target_chat_config")} ({chats.length})</h2>
                            </div>
                            <button onClick={handleAddChat} className="btn-secondary !h-8 !px-3 font-bold !text-[10px]">
                                + {t("add_chat")}
                            </button>
                        </div>

                        {chats.length === 0 ? (
                            <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-2xl text-main/20">
                                <p className="text-sm">{t("no_target_chat")}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {chats.map((chat, idx) => (
                                    <div key={idx} className="glass-panel !bg-black/5 p-4 flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                                            <div>
                                                <div className="font-bold text-sm">{chat.name || String(chat.chat_id)}</div>
                                                <div className="text-[10px] text-main/30 font-mono mt-0.5">
                                                    {t("id_label")}: {chat.chat_id} | <span className="text-[#8a3ffc]/60 font-bold">{chat.actions.length} {t("actions_count")}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => setChats(chats.filter((_, i) => i !== idx))} className="action-btn !text-rose-400 hover:!bg-rose-500/10">
                                            <Trash weight="bold" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <div className="flex gap-4 pt-4">
                        <button onClick={() => router.back()} className="btn-secondary flex-1">{t("cancel")}</button>
                        <button onClick={handleSubmit} disabled={loading} className="btn-gradient flex-1">
                            {loading
                                ? <Spinner className="animate-spin mx-auto" weight="bold" />
                                : isEditing ? (t("save_changes") || "保存修改") : t("deploy_task")
                            }
                        </button>
                    </div>
                </div>
                )}
            </main>

            {/* Chat 配置弹窗 */}
            {editingChat && (
                <div className="modal-overlay active fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="glass-panel modal-content w-full max-w-lg animate-scale-in flex flex-col overflow-hidden">
                        <header className="p-6 border-b border-white/5 flex justify-between items-center bg-black/5">
                            <h2 className="text-xl font-bold flex items-center gap-3">
                                <div className="p-2 bg-[#8a3ffc]/10 rounded-lg text-[#b57dff]">
                                    <Plus weight="bold" size={20} />
                                </div>
                                {t("configure_target_chat")}
                            </h2>
                            <button onClick={() => setEditingChat(null)} className="action-btn !w-8 !h-8"><X weight="bold" /></button>
                        </header>

                        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-widest font-bold text-main/40">{t("select_target_chat")}</label>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-main/40 uppercase tracking-wider">{t("search_chat")}</label>
                                    <input className="!mb-0" placeholder={t("search_chat_placeholder")} value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} />
                                </div>
                                {chatSearch.trim() ? (
                                    <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/5 bg-black/5">
                                        {chatSearchLoading ? (
                                            <div className="px-3 py-2 text-xs text-main/40">{t("searching")}</div>
                                        ) : chatSearchResults.length > 0 ? (
                                            <div className="flex flex-col">
                                                {chatSearchResults.map((chat) => {
                                                    const title = chat.title || chat.username || String(chat.id);
                                                    return (
                                                        <button key={chat.id} type="button"
                                                            className="text-left px-3 py-2 hover:bg-white/5 border-b border-white/5 last:border-b-0"
                                                            onClick={() => { setEditingChat({ ...editingChat, chat_id: chat.id, name: title }); setChatSearch(""); setChatSearchResults([]); }}
                                                        >
                                                            <div className="text-sm font-semibold truncate">{title}</div>
                                                            <div className="text-[10px] text-main/40 font-mono truncate">{chat.id}{chat.username ? ` · @${chat.username}` : ""}</div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="px-3 py-2 text-xs text-main/40">{t("search_no_results")}</div>
                                        )}
                                    </div>
                                ) : (
                                    <select className="mt-2" value={editingChat.chat_id}
                                        onChange={(e) => {
                                            const cid = parseInt(e.target.value);
                                            const chat = availableChats.find(c => c.id === cid);
                                            setEditingChat({ ...editingChat, chat_id: cid, name: chat?.title || chat?.username || "" });
                                        }}
                                    >
                                        <option value={0}>{t("select_chat_placeholder")}</option>
                                        {availableChats.map(c => <option key={c.id} value={c.id}>{c.title || c.username}</option>)}
                                    </select>
                                )}
                                <div className="mt-4">
                                    <label className="text-[10px] text-main/40 uppercase tracking-wider">{t("topic_id_label") || "Topic/Thread ID (Optional)"}</label>
                                    <input inputMode="numeric" className="!mb-0"
                                        placeholder={t("topic_id_placeholder") || "Leave blank if not applicable"}
                                        value={editingChat.message_thread_id || ""}
                                        onChange={(e) => setEditingChat({ ...editingChat, message_thread_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs uppercase tracking-widest font-bold text-main/40">{t("action_sequence_title")}</label>
                                    <button onClick={() => setEditingChat({ ...editingChat, actions: [...editingChat.actions, { action: 1, text: "" }] })}
                                        className="text-[10px] font-bold text-[#8a3ffc] hover:underline">
                                        + {t("add_sign_action")}
                                    </button>
                                </div>
                                <div className="max-h-[350px] overflow-y-auto space-y-2 custom-scrollbar pr-1">
                                    {editingChat.actions.map((act, i) => (
                                        <div key={i} className="flex flex-col gap-2 animate-scale-in p-3 rounded-xl bg-white/3 border border-white/5">
                                            {/* 动作类型选择行 */}
                                            <div className="flex gap-2 items-center">
                                                <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-[9px] font-bold text-main/30 flex-shrink-0">{i + 1}</div>
                                                <select className="!h-8 !text-xs !mb-0 flex-1"
                                                    value={act.action}
                                                    onChange={(e) => {
                                                        const newActs = [...editingChat.actions];
                                                        newActs[i] = defaultActionData(parseInt(e.target.value));
                                                        setEditingChat({ ...editingChat, actions: newActs });
                                                    }}
                                                >
                                                    {ACTION_TYPES.map(at => (
                                                        <option key={at.value} value={at.value}>{t(at.labelKey)}</option>
                                                    ))}
                                                </select>
                                                <button onClick={() => setEditingChat({ ...editingChat, actions: editingChat.actions.filter((_, idx) => idx !== i) })}
                                                    className="action-btn !w-8 !h-8 !text-rose-400 flex-shrink-0">
                                                    <X weight="bold" />
                                                </button>
                                            </div>

                                            {/* 发送文本 / 点击按钮：文本输入 */}
                                            {(act.action === 1 || act.action === 3) && (
                                                <input className="!h-8 !text-xs !mb-0"
                                                    value={act.text || ""}
                                                    placeholder={act.action === 1 ? t("placeholder_msg") : t("placeholder_btn")}
                                                    onChange={(e) => {
                                                        const newActs = [...editingChat.actions];
                                                        newActs[i] = { ...act, text: e.target.value };
                                                        setEditingChat({ ...editingChat, actions: newActs });
                                                    }}
                                                />
                                            )}

                                            {/* 发送骰子：emoji 选择 */}
                                            {act.action === 2 && (
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {DICE_OPTIONS.map(emoji => (
                                                        <button key={emoji} type="button"
                                                            onClick={() => {
                                                                const newActs = [...editingChat.actions];
                                                                newActs[i] = { ...act, dice: emoji };
                                                                setEditingChat({ ...editingChat, actions: newActs });
                                                            }}
                                                            className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${act.dice === emoji ? "bg-[#8a3ffc]/30 ring-1 ring-[#8a3ffc]" : "bg-white/5 hover:bg-white/10"}`}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                                            {/* AI 自动类动作：显示具体说明 */}
                                            {[4, 5, 6, 7].includes(act.action) && (
                                                <p className="text-[10px] text-[#b57dff]/60 italic px-1 leading-relaxed">
                                                    {t(`ai_hint_${act.action}` as any)}
                                                </p>
                                            )}

                                            {/* 类型 4：可选 question 字段 */}
                                            {act.action === 4 && (
                                                <div className="space-y-1">
                                                    <label className="text-[9px] text-main/30 uppercase tracking-wider block">
                                                        {t("ai_vision_question_label")}
                                                    </label>
                                                    <input
                                                        className="!h-8 !text-xs !mb-0"
                                                        value={act.question || ""}
                                                        placeholder={t("ai_vision_question_placeholder")}
                                                        onChange={(e) => {
                                                            const newActs = [...editingChat.actions];
                                                            newActs[i] = { ...act, question: e.target.value };
                                                            setEditingChat({ ...editingChat, actions: newActs });
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            {/* 关键词监听 */}
                                            {act.action === 8 && (
                                                <div className="space-y-2">
                                                    <div>
                                                        <label className="text-[9px] text-main/30 uppercase tracking-wider block mb-1">{t("monitor_keywords")}</label>
                                                        <textarea className="!text-xs !mb-0 resize-none w-full rounded-lg px-3 py-2 bg-white/5 border border-white/10 focus:border-[#8a3ffc]/50 outline-none" rows={3}
                                                            placeholder={t("monitor_keywords_placeholder")}
                                                            value={(act.keywords || []).join("\n")}
                                                            onChange={(e) => {
                                                                const keywords = e.target.value.split(/[\n,]/).map((k: string) => k.trim()).filter(Boolean);
                                                                const newActs = [...editingChat.actions];
                                                                newActs[i] = { ...act, keywords };
                                                                setEditingChat({ ...editingChat, actions: newActs });
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="text-[9px] text-main/30 uppercase tracking-wider block mb-1">{t("match_mode")}</label>
                                                            <select className="!h-8 !text-xs !mb-0 w-full"
                                                                value={act.match_mode || "contains"}
                                                                onChange={(e) => {
                                                                    const newActs = [...editingChat.actions];
                                                                    newActs[i] = { ...act, match_mode: e.target.value };
                                                                    setEditingChat({ ...editingChat, actions: newActs });
                                                                }}
                                                            >
                                                                <option value="contains">{t("match_contains")}</option>
                                                                <option value="exact">{t("match_exact")}</option>
                                                                <option value="regex">{t("match_regex")}</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex items-end pb-1">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input type="checkbox"
                                                                    checked={act.ignore_case !== false}
                                                                    onChange={(e) => {
                                                                        const newActs = [...editingChat.actions];
                                                                        newActs[i] = { ...act, ignore_case: e.target.checked };
                                                                        setEditingChat({ ...editingChat, actions: newActs });
                                                                    }}
                                                                />
                                                                <span className="text-xs">{t("ignore_case")}</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] text-main/30 uppercase tracking-wider block mb-1">{t("push_channel")}</label>
                                                        <select className="!h-8 !text-xs !mb-0 w-full"
                                                            value={act.push_channel || "telegram"}
                                                            onChange={(e) => {
                                                                const newActs = [...editingChat.actions];
                                                                newActs[i] = { ...act, push_channel: e.target.value };
                                                                setEditingChat({ ...editingChat, actions: newActs });
                                                            }}
                                                        >
                                                            <option value="telegram">{t("push_telegram")}</option>
                                                            <option value="forward">{t("push_forward")}</option>
                                                            <option value="bark">{t("push_bark")}</option>
                                                            <option value="custom">{t("push_custom")}</option>
                                                            <option value="continue">{t("push_continue")}</option>
                                                        </select>
                                                    </div>
                                                    {act.push_channel === "bark" && (
                                                        <div>
                                                            <label className="text-[9px] text-main/30 uppercase tracking-wider block mb-1">{t("bark_url_label")}</label>
                                                            <input className="!h-8 !text-xs !mb-0"
                                                                placeholder="https://api.day.app/yourkey/"
                                                                value={act.bark_url || ""}
                                                                onChange={(e) => {
                                                                    const newActs = [...editingChat.actions];
                                                                    newActs[i] = { ...act, bark_url: e.target.value };
                                                                    setEditingChat({ ...editingChat, actions: newActs });
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                    {act.push_channel === "custom" && (
                                                        <div>
                                                            <label className="text-[9px] text-main/30 uppercase tracking-wider block mb-1">{t("custom_push_url")}</label>
                                                            <input className="!h-8 !text-xs !mb-0"
                                                                placeholder={t("custom_push_url_placeholder")}
                                                                value={act.custom_url || ""}
                                                                onChange={(e) => {
                                                                    const newActs = [...editingChat.actions];
                                                                    newActs[i] = { ...act, custom_url: e.target.value };
                                                                    setEditingChat({ ...editingChat, actions: newActs });
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                    {act.push_channel === "forward" && (
                                                        <div>
                                                            <label className="text-[9px] text-main/30 uppercase tracking-wider block mb-1">{t("forward_chat_id_label")}</label>
                                                            <input className="!h-8 !text-xs !mb-0"
                                                                placeholder="-1001234567890"
                                                                value={act.forward_chat_id || ""}
                                                                onChange={(e) => {
                                                                    const newActs = [...editingChat.actions];
                                                                    newActs[i] = { ...act, forward_chat_id: e.target.value };
                                                                    setEditingChat({ ...editingChat, actions: newActs });
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                    {act.push_channel === "continue" && (
                                                        <div>
                                                            <label className="text-[9px] text-main/30 uppercase tracking-wider block mb-1">{t("continue_chat_id_label")}</label>
                                                            <input className="!h-8 !text-xs !mb-0"
                                                                placeholder="-1001234567890"
                                                                value={act.continue_chat_id || ""}
                                                                onChange={(e) => {
                                                                    const newActs = [...editingChat.actions];
                                                                    newActs[i] = { ...act, continue_chat_id: e.target.value };
                                                                    setEditingChat({ ...editingChat, actions: newActs });
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {editingChat.actions.length === 0 && (
                                        <div className="text-center py-4 text-xs text-main/20 italic">{t("no_actions_hint")}</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 测试发送区域 */}
                        {editingChat.chat_id !== 0 && (
                            <div className="px-6 pb-4 border-t border-white/5 pt-4 bg-black/5">
                                <label className="text-[10px] text-main/30 uppercase tracking-wider block mb-2">
                                    {t("test_send_label") || "测试发送消息"}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        className="!h-9 !text-xs !mb-0 flex-1"
                                        value={testText}
                                        onChange={(e) => setTestText(e.target.value)}
                                        placeholder="/checkin"
                                        onKeyDown={(e) => e.key === "Enter" && !testSending && handleTestSend()}
                                    />
                                    <button
                                        onClick={handleTestSend}
                                        disabled={testSending || !testText.trim()}
                                        className="btn-secondary !h-9 !px-4 !text-xs font-bold flex items-center gap-1.5 flex-shrink-0 disabled:opacity-40"
                                    >
                                        {testSending
                                            ? <Spinner size={12} className="animate-spin" />
                                            : <Lightning size={12} weight="fill" />
                                        }
                                        {t("test_send_btn") || "发送测试"}
                                    </button>
                                </div>
                                <p className="text-[9px] text-main/20 mt-1.5">
                                    {t("test_send_hint")}
                                </p>
                            </div>
                        )}

                        <footer className="p-6 border-t border-white/5 flex gap-4 bg-black/10">
                            <button onClick={() => setEditingChat(null)} className="btn-secondary flex-1">{t("cancel")}</button>
                            <button onClick={handleSaveChat} className="btn-gradient flex-1 flex items-center justify-center gap-2">
                                <Check weight="bold" />{t("confirm_add")}
                            </button>
                        </footer>
                    </div>
                </div>
            )}

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
}

export default function CreateSignTaskPage() {
    return (
        <Suspense fallback={null}>
            <CreateSignTaskContent />
        </Suspense>
    );
}
