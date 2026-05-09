from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional
from urllib.parse import quote

import httpx

logger = logging.getLogger("backend.push_notifications")


def _as_int_or_none(value: Any) -> Optional[int]:
    try:
        if value is None or str(value).strip() == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _get_global_proxy() -> Optional[str]:
    """Read proxy from environment or global settings.

    Priority: TG_PROXY env → global_proxy in settings.
    Returns a normalised URL string or ``None``.
    """
    env_proxy = os.environ.get("TG_PROXY", "").strip()
    if env_proxy:
        from backend.utils.proxy import normalize_proxy_url
        return normalize_proxy_url(env_proxy)

    try:
        from backend.services.config import get_config_service
        from backend.utils.proxy import normalize_proxy_url

        proxy = get_config_service().get_global_settings().get("global_proxy")
        if isinstance(proxy, str) and proxy.strip():
            return normalize_proxy_url(proxy.strip())
    except Exception:
        pass
    return None


def _build_httpx_client(timeout: int = 10) -> httpx.AsyncClient:
    """Build an httpx.AsyncClient with proxy support if configured."""
    proxy_url = _get_global_proxy()
    kwargs: Dict[str, Any] = {"timeout": timeout}
    if proxy_url:
        # httpx >= 0.28 uses ``proxy`` (single URL string).
        # Older versions used ``proxies`` (dict mapping). Try modern API first.
        try:
            return httpx.AsyncClient(proxy=proxy_url, **kwargs)
        except TypeError:
            kwargs["proxies"] = {"all://": proxy_url}
    return httpx.AsyncClient(**kwargs)


async def send_telegram_bot_message(
    *,
    bot_token: str,
    chat_id: str,
    text: str,
    message_thread_id: Optional[int] = None,
) -> None:
    payload: Dict[str, Any] = {
        "chat_id": chat_id,
        "text": text[:3900],
        "disable_web_page_preview": False,
    }
    if message_thread_id is not None:
        payload["message_thread_id"] = message_thread_id

    async with _build_httpx_client() as client:
        response = await client.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json=payload,
        )
        if response.status_code != 200:
            # Telegram returns {"ok": false, "description": "..."} on errors
            try:
                error_detail = response.json()
                description = error_detail.get("description", response.text)
            except Exception:
                description = response.text
            logger.error(
                "Telegram Bot API error: HTTP %s, chat_id=%s, detail=%s",
                response.status_code,
                chat_id,
                description,
            )
            response.raise_for_status()


async def send_keyword_push(settings: Dict[str, Any], payload: Dict[str, Any]) -> None:
    channel = (settings.get("keyword_monitor_push_channel") or "telegram").strip()
    title = str(payload.get("title") or "TG-SignPulse 关键词命中")
    body = str(payload.get("body") or "")
    url = str(payload.get("url") or "")

    if channel == "telegram":
        bot_token = (settings.get("telegram_bot_token") or "").strip()
        chat_id = (settings.get("telegram_bot_chat_id") or "").strip()
        if not bot_token or not chat_id:
            logger.warning("Keyword monitor Telegram notification is not configured")
            return
        text = f"{title}\n\n{body}"
        if url:
            text += f"\n\n链接: {url}"
        await send_telegram_bot_message(
            bot_token=bot_token,
            chat_id=chat_id,
            text=text,
            message_thread_id=_as_int_or_none(
                settings.get("telegram_bot_message_thread_id")
            ),
        )
        return

    if channel == "bark":
        bark_url = (settings.get("keyword_monitor_bark_url") or "").strip()
        if not bark_url:
            logger.warning("Keyword monitor Bark URL is not configured")
            return
        data = {"title": title, "body": body}
        if url:
            data["url"] = url
        async with _build_httpx_client() as client:
            response = await client.post(bark_url, json=data)
            response.raise_for_status()
        return

    custom_url = (settings.get("keyword_monitor_custom_url") or "").strip()
    if not custom_url:
        logger.warning("Keyword monitor custom push URL is not configured")
        return

    request_payload = dict(payload)
    request_payload["title"] = title
    request_payload["body"] = body
    request_payload["url"] = url

    if any(token in custom_url for token in ("{title}", "{body}", "{url}")):
        final_url = (
            custom_url.replace("{title}", quote(title))
            .replace("{body}", quote(body))
            .replace("{url}", quote(url))
        )
        async with _build_httpx_client() as client:
            response = await client.get(final_url)
            response.raise_for_status()
        return

    async with _build_httpx_client() as client:
        response = await client.post(custom_url, json=request_payload)
        response.raise_for_status()


async def send_login_notification(
    settings: Dict[str, Any],
    *,
    username: str,
    ip_address: str,
) -> None:
    if not settings.get("telegram_bot_notify_enabled"):
        return
    if not settings.get("telegram_bot_login_notify_enabled"):
        return

    bot_token = (settings.get("telegram_bot_token") or "").strip()
    chat_id = (settings.get("telegram_bot_chat_id") or "").strip()
    if not bot_token or not chat_id:
        logger.warning("Telegram login notification is not configured")
        return

    text = (
        "TG-SignPulse 登录通知\n"
        f"用户: {username}\n"
        f"IP: {ip_address or 'unknown'}"
    )
    await send_telegram_bot_message(
        bot_token=bot_token,
        chat_id=chat_id,
        text=text,
        message_thread_id=_as_int_or_none(settings.get("telegram_bot_message_thread_id")),
    )
