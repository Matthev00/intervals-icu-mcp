# intervals-icu-mcp

Serwer MCP do planowania treningów triathlonowych w [Intervals.icu](https://intervals.icu). Działa jako bezstanowy Cloudflare Worker, a ten sam kod uruchamia się lokalnie przez `wrangler dev`.

## Narzędzia

| Narzędzie | Do czego służy |
| --- | --- |
| `get_athlete` | dzisiejsza data, progi i strefy dla każdego sportu |
| `list_activities` | wykonane aktywności z zakresu dat |
| `get_activity` | szczegóły aktywności, opcjonalnie z interwałami |
| `list_wellness` | CTL, ATL, ramp rate, HRV, sen, samopoczucie |
| `list_events` | plan w kalendarzu: treningi, wyścigi, notatki |
| `create_events` | utworzenie do 50 wpisów naraz |
| `update_event` | zmiana wybranych pól wpisu |
| `delete_events` | usunięcie wpisów po id |

Usuwanie działa tylko po id. Nie ma kasowania całego zakresu dat, żeby Claude nie mógł przez pomyłkę zdjąć z kalendarza wyścigu.

## Uruchomienie lokalne

```bash
npm install
```

```bash
cp .dev.vars.example .dev.vars
```

W `.dev.vars` ustaw:

- `INTERVALS_API_KEY`: klucz z sekcji Developer Settings w [ustawieniach Intervals.icu](https://intervals.icu/settings),
- `MCP_AUTH_TOKEN`: własny losowy token, na przykład z `openssl rand -hex 32`.

```bash
npm run dev
```

Podłączenie do Claude Code, po wstawieniu tokena:

```bash
claude mcp add --transport http intervals http://localhost:8787/mcp --header "Authorization: Bearer TWOJ_TOKEN"
```

## Deploy na Cloudflare z GitHuba

1. Wypchnij repo na GitHuba.
2. W panelu Cloudflare wybierz Workers & Pages, Create application, Import a repository i wskaż to repo.
3. Zostaw nazwę `intervals-icu-mcp`, bo musi być taka sama jak `name` w `wrangler.jsonc`. Deploy command to `npx wrangler deploy`.
4. Po pierwszym deployu dodaj w Settings, Variables and Secrets dwa sekrety typu Secret: `INTERVALS_API_KEY` i `MCP_AUTH_TOKEN`.

Każdy push na `main` wdraża nową wersję, a sekrety zostają na miejscu. Wystarczy darmowy plan Workers.

## Podłączenie zdalne

Claude.ai i rutyny w chmurze łączą się z serwerów Anthropic, więc potrzebują adresu publicznego. W Settings, Connectors dodaj własny connector z opcją No sign-in i adresem:

```text
https://intervals-icu-mcp.TWOJA-SUBDOMENA.workers.dev/s/TWOJ_TOKEN/mcp
```

Claude Code może łączyć się zdalnie tak samo jak lokalnie, przez `/mcp` i nagłówek `Authorization`.

Ten adres jest hasłem: kto go ma, może zmieniać Twój kalendarz. Jeśli wycieknie, zmień `MCP_AUTH_TOKEN` i dodaj connector od nowa. Logi Workera są celowo wyłączone, bo zapisywałyby adres razem z tokenem.

## Ograniczenia

Intervals.icu nie udostępnia przez API aktywności zaimportowanych ze Stravy. Jeśli zegarek synchronizuje się tylko przez Stravę, `list_activities` zwróci je bez danych. Podłącz Garmina lub inne źródło bezpośrednio.

## Rozwój

```bash
npm run typecheck
```

```bash
npm test
```
