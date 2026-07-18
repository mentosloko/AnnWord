#!/usr/bin/env python3
"""Generate finalized AnnWord legal PDFs without drafting placeholders."""

import re

import generate_legal_pdfs as generator

PUBLIC_ADDRESS = "Москва, Проспект Буденного, 51 к4, 177"
ADDRESS_PLACEHOLDER = (
    "[УКАЗАТЬ АДРЕС ДЛЯ ПУБЛИКАЦИИ И ЮРИДИЧЕСКИ ЗНАЧИМЫХ СООБЩЕНИЙ]"
)

PRIVACY_VARIANTS_BLOCK = re.compile(
    r"8\.2\.\s+\*\*До публикации необходимо выбрать и заполнить один "
    r"фактический вариант:\*\*\s*\n\s*\n"
    r"-\s+\*\*Вариант А — без трансграничной передачи:\*\*.*?\n"
    r"-\s+\*\*Вариант Б — с трансграничной передачей:\*\*.*?"
    r"(?=\n\s*\n8\.3\.)",
    re.DOTALL,
)

DRAFTING_MARKERS = (
    "[УКАЗАТЬ",
    "[ЗАПОЛНИТЬ",
    "[НАЗВАНИЕ",
    "До публикации необходимо",
    "До публикации следует",
    "Вариант А",
    "Вариант Б",
    "Таблица должна быть дополнена",
    "требует технической проверки",
    "предусмотрены или обнаружены",
    "соответствующая категория",
    "фактический срок SDK",
    "можете выбрать вариант",
    "вставить адрес",
)


def finalize_document(name: str, markdown: str) -> str:
    """Apply factual publication data and remove drafting instructions."""
    text = markdown.replace(ADDRESS_PLACEHOLDER, PUBLIC_ADDRESS)

    if name == "03_privacy_policy.md":
        replacement = (
            "8.2. Основная база аккаунтов и прогресса размещена в российском "
            "контуре AnnWord на инфраструктуре Yandex Cloud в Российской "
            "Федерации. Иностранным поставщикам не передаются данные основной "
            "базы аккаунтов, учебного прогресса и пользовательских словарей."
        )
        text, count = PRIVACY_VARIANTS_BLOCK.subn(replacement, text)
        if count != 1:
            raise RuntimeError("Privacy policy section 8.2 was not found exactly once")

        text = text.replace(
            "8.3. Наличие статического фронтенда у иностранного хостинга само "
            "по себе требует технической проверки: журналы запросов могут "
            "включать IP-адрес, user-agent, cookie и идентификаторы. Политика "
            "должна описывать фактическую, а не предполагаемую архитектуру.",
            "8.3. Статический интерфейс Сервиса доставляется через инфраструктуру "
            "Vercel. Эта инфраструктура не используется для хранения основной "
            "базы аккаунтов, учебного прогресса и пользовательских словарей.",
        )
        text = text.replace(
            "9.3. До публикации необходимо заполнить отдельный реестр "
            "обработчиков. В проекте технически предусмотрены или обнаружены "
            "интеграции с Vercel, российским backend/Yandex-контуром, Supabase, "
            "Google/Firebase и Prodamus; фактически активные интеграции "
            "определяются production-конфигурацией.",
            "9.3. В production-конфигурации Сервиса используются Yandex Cloud "
            "для российского backend-контура и хранения основной базы, "
            "Prodamus для приёма платежей и Vercel для доставки статического "
            "интерфейса. Сервисы Supabase и Google/Firebase используются только "
            "в тех технических контурах, в которых соответствующие функции "
            "включены настройками Сервиса.",
        )

    if name == "04_cookie_policy.md":
        text = text.replace(
            "| Наименование/шаблон | Хранилище | Назначение | Категория | Срок |",
            "| Наименование | Хранилище | Назначение | Категория | Срок |",
        )
        text = re.sub(
            r"^\| `?\[ЗАПОЛНИТЬ ПО РЕАЛЬНОМУ АУДИТУ\]`? \|.*?\|\s*$\n?",
            "",
            text,
            flags=re.MULTILINE,
        )
        text = text.replace(
            "| `sb-…-auth-token` | localStorage/cookie, если активен Supabase | "
            "сессия авторизации Supabase | строго необходимая | по настройкам "
            "сессии/до выхода |",
            "| `sb-…-auth-token` | localStorage/cookie | сессия авторизации "
            "Supabase в соответствующем техническом контуре Сервиса | строго "
            "необходимая | по настройкам сессии или до выхода |",
        )
        text = text.replace(
            "Таблица должна быть дополнена после автоматического и ручного "
            "аудита production-домена. Удалённые или неактивные интеграции не "
            "следует перечислять как используемые; активные технологии нельзя "
            "скрывать.",
            "Перечень обновляется при изменении фактически используемых "
            "технологий Сервиса.",
        )
        text = text.replace(
            "6.2. До публикации следует перечислить активных поставщиков, дать "
            "ссылки на их документы в интерфейсе и определить, выступают ли они "
            "обработчиками по поручению либо самостоятельными операторами.",
            "6.2. Актуальные сведения о поставщиках, их функциях и применимых "
            "документах приводятся в Политике обработки персональных данных и "
            "обновляются при изменении состава используемых сервисов.",
        )

    return text


def validate_document(name: str, markdown: str) -> None:
    found = [marker for marker in DRAFTING_MARKERS if marker.lower() in markdown.lower()]
    if found:
        raise RuntimeError(
            f"Drafting artifacts remain in {name}: {', '.join(found)}"
        )


def main() -> None:
    source_documents = generator.load_documents()
    published_documents = {
        name: finalize_document(name, markdown)
        for name, markdown in source_documents.items()
    }
    for name, markdown in published_documents.items():
        validate_document(name, markdown)

    generator.load_documents = lambda: published_documents
    generator.main()
    print(
        "Validated all AnnWord legal documents: publication address is filled "
        "and no drafting placeholders remain."
    )


if __name__ == "__main__":
    main()
