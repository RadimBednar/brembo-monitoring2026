# Brembo Monitoring

Aplikace pro monitorování stavu linek (Assembly a Machining).

## 🚀 Plánovaný refaktoring pro ostrou verzi (Produkce)

Aby byla aplikace plně stabilní a připravená na non-stop ostrý provoz, je potřeba u kódu provést následující úpravy:

1. **Rozdělení JS do modulů:**
   - Rozbít aktuální monolitický `app.js` na menší logické celky (např. `state.js` pro data, `ui.js` pro render karet, `map.js` pro SVG).

2. **Optimalizace překreslování (Zrušení innerHTML):**
   - Místo plošného přepisování celých HTML bloků přes `innerHTML` využít cílené updaty v DOMu (měnit jen konkrétní třídy a texty uzlů). Zabrání to memory leakům a problikávání UI na televizích.

3. **Zabezpečení proti XSS:**
   - Při výpisu uživatelských dat z databáze používat bezpečný `textContent` místo vkládání proměnných přímo do HTML řetězců.

4. **Přechod na WebSockets (Real-time data):**
   - Zrušit frontendový polling (neustálé dotazování na server).
   - Vytvořit Node.js backend napojený na MS SQL, který bude přes knihovnu `Socket.io` aktivně posílat do frontendu zprávy pouze ve chvíli, kdy na lince reálně dojde ke změně stavu.
