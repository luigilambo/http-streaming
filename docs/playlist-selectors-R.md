# PLAYLIST SELECTORS

## Obiettivi
Il file definisce una serie di selettori che possono essere utilizzati nella scelta della playlist video più adeguata in base alle condizioni di rete e alle dimensioni del player: 
1. `lastBandwidthSelector`, che nella scelta tiene in considerazione anche il rapporto di forma del dispositivo;
2. `movingAverageBandwidthSelector`, che utilizza la media mobile pesata esponenzialmente della larghezza di banda; 
3. `minBufferMaxBandwidthSelector`, che seleziona la playlist che minimizza il rebuffering; 
4. `lowestBitrateCompatibleVariantSelector`, che semplicemente seleziona la playlist con il bitrate più basso fra quelle che contengono video. 

Tutti questi selettori specifici sono basati su un selettore generico, detto `simpleSelector` definito nella prima porzione del file. 

## Analisi dettagliata del codice

In principio viene definito [`representationToString`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22representationToString%22%5D "src/playlist-selectors.js") che riceve come argomento un oggetto `representation` e, dopo aver verificato che questo e la relativa playlist siano definite,  restituisce un nuovo oggetto con alcune proprietà:
- id;
- Bandwidth; 
- Width;
- Height; 
- Codecs. 

...


In seguito vi è la definizione di [`stableSort`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22stableSort%22%5D "src/playlist-selectors.js"), una funzione di ordinamento riutilizzabile. 
`stableSort` riceve in ingresso un array di elementi da ordinare e una funzione di confronto fra due elementi e riordina gli elementi in base alla funzione passata. Trattandosi di un algoritmo di ordinamento stabile, se due elementi sono considerati uguali dalla funzione di confronto, essi mantengono l’ordine relativo che avevano nell’array iniziale.


E' definita una funzione di comparazione,  [`comparePlaylistBandwidth`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22comparePlaylistBandwidth%22%5D "src/playlist-selectors.js"), che ordina due playlist **in base alla larghezza di banda**.
La funzione accetta due parametri, 
`left` e `right`, che rappresentano le due playlist da comparare. 
Ogni oggetto playlist ha un attributo `BANDWIDTH` all'interno dei `attributes`, che rappresenta la larghezza di banda della playlist, quindi se le rispettive bande dei due termini di confronto sono definite, sono estratte come [`leftBandwidth`] e [`rightBandwidth`], altrimenti, al termine che manca di `BANDWIDTH` viene assegnata `window.Number.MAX_VALUE`, che rappresenta il numero più grande possibile in JavaScript.

Infine, la funzione ritorna la differenza tra [`leftBandwidth`] e [`rightBandwidth`]. Questo valore sarà maggiore di zero se la larghezza di banda di `left` è maggiore di quella di `right`, minore di zero se la larghezza di banda di `right` è maggiore di quella di `left`, e esattamente zero se le due larghezze di banda sono uguali. Questo valore verrà quindi utilizzato per ordinare gli oggetti playlist.

E' presente anche la definizione di una funzione di comparazione chiamata [`comparePlaylistResolution`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22comparePlaylistResolution%22%5D "src/playlist-selectors.js"), utilizzata per ordinare due **playlist in base alla loro risoluzione (larghezza)**.

La funzione prende due parametri: `left` e `right`, che rappresentano due oggetti playlist. Ogni oggetto playlist ha un attributo `RESOLUTION` all'interno del campo `attributes`, che rappresenta la risoluzione della playlist.
Similmente a quanto accade per la funzione precedente, per ognuno dei due termini di comparazione, `left` e `right`, se la larghezza della risoluzione è definita, viene assegnata ad una variabile, rispettivamente [`leftWidth`] e [`rightWidth`], altrimenti viene assegnato `window.Number.MAX_VALUE`.

In seguito, la funzione controlla se le larghezze delle risoluzioni dei due oggetti playlist sono uguali e se entrambi hanno un attributo `BANDWIDTH`. In tal caso, ritorna la differenza tra i valori di `BANDWIDTH` dei due oggetti playlist. Questo serve come un metodo di fallback per ordinare le playlist nel caso in cui più playlist abbiano la stessa risoluzione. 
Altrimenti, se le larghezze delle risoluzioni non sono uguali, la funzione ritorna la differenza tra [`leftWidth`] e [`rightWidth`].
Di conseguenza, l'output è maggiore di 0 se la prima playlist ha una risoluzione maggiore della seconda, minore di 0 se la prima playlist ha una risoluzione inferiore, 0 altrimenti. 

## simpleSelector
La funzione [`simpleSelector`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22simpleSelector%22%5D "src/playlist-selectors.js") è utilizzata per **scegliere la playlist appropriata in base alla larghezza di banda** e alle dimensioni del lettore.

La funzione prende in input sei parametri:
- `main`, una rappresentazione oggetto del manifesto principale;
- `playerBandwidth`, la larghezza di banda corrente calcolata del player;
- `playerWidth` e `playerHeight`, la larghezza e l'altezza del player;
- `limitRenditionByPlayerDimensions`,booleano che, se vero, indica che le dimensioni del lettore dovrebbero essere tenute in considerazione durante la selezione;
- `playlistController`, l'oggetto playlistController corrente.

Il primo controllo effettuato nella funzione è riguardo l'oggetto `main`: se non è disponibile, la funzione esce immediatamente.

In seguito viene creato un oggetto [`options`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22options%22%5D "src/playlist-selectors.js") che contiene le opzioni per la selezione della playlist. 

La funzione quindi ottiene le playlist dal manifesto principale e le converte in una rappresentazione intermedia per facilitare i confronti. Questa rappresentazione intermedia include la larghezza di banda, la larghezza, l'altezza e la playlist stessa. Se la larghezza di banda non è disponibile, viene impostata su `window.Number.MAX_VALUE`.

In seguito, le playlist sono ordinate all'interno dell'array [`sortedPlaylistReps`] in base alla banda (crescente), tramite l'algoritmo [`stableSort`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22stableSort%22%5D "src/playlist-selectors.js"). 

Fatto ciò, tramite il metodo `filter()` si ottengono una serie di nuovi array. 
Inizialmente, vengono filtrate tutte le playlist che sono state escluse a causa di configurazioni incompatibili. 
Successivamente, vengono filtrate tutte le playlist che sono state disabilitate manualmente attraverso l'API o escluse temporaneamente a causa di errori di riproduzione ed il risultato è posto in [`enabledPlaylistReps`]. 
(Se non ci sono playlist abilitate, allora tutte sono state escluse o disabilitate dall'utente attraverso l'API. In questo caso, l'esclusione viene ignorata e si ricade sulle playlist che l'utente non ha disabilitato).


In seguito, vengono filtrate tutte le varianti che hanno un bitrate effettivo superiore alla larghezza di banda stimata corrente. Questo viene fatto confrontando la proprietà [`bandwidth`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22bandwidth%22%5D "src/playlist-selectors.js") di ogni rappresentazione con la larghezza di banda del player, tenendo conto di una certa varianza.
```javascript
  const bandwidthPlaylistReps = enabledPlaylistReps.filter((rep) => rep.bandwidth * Config.BANDWIDTH_VARIANCE < playerBandwidth);
```

Infine, vengono selezionate tutte le rappresentazioni con lo stesso (massimo) bitrate e viene preso il primo elemento, posto in [`bandwidthBestRep`]. 

Ora, se la scelta non tiene in considerazione la dimensione attuale del player `limitRenditionByPlayerDimensions === false`, possiamo già decidere qual è la playlist successiva. 

La variabile [`chosenRep`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22chosenRep%22%5D "src/playlist-selectors.js") definisce la playlist che verrà proposta come successiva in questo caso e viene assegnata utilizzando l'operatore logico OR (`||`), il quale restituisce il primo valore veritiero che incontra, o 'null' se nessuno dei valori è veritiero. In questo caso, [`chosenRep`] sarà assegnato al primo valore non non `null` tra [`bandwidthBestRep`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22bandwidthBestRep%22%5D "src/playlist-selectors.js"), [`enabledPlaylistReps[0]`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22enabledPlaylistReps%5B0%5D%22%5D "src/playlist-selectors.js"), e [`sortedPlaylistReps[0]`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22sortedPlaylistReps%5B0%5D%22%5D "src/playlist-selectors.js").

Se [`chosenRep`] e il relativo campo [`chosenRep.playlist`] non sono `null`, si procede a determinare il tipo di [`chosenRep`] al fine di registrare un messaggio di log ed in seguito restituisce [`chosenRep.playlist`], la playlist associata alla rappresentazione scelta.
Altrimenti, se [`chosenRep`] o [`chosenRep.playlist`] non sono veritieri, il codice registra un messaggio di log che indica che non è stato possibile scegliere una playlist, e restituisce `null`.


Se è necessario tenere in considerazione anche della dimensione del player nella scelta, i passi da compiere sono i seguenti: 

Inizialmente, a partire dall'array contenente le playlist che hanno un bitrate inferiore alla banda stimata, si va a filtrare quelle che possiedono informazioni sulla risoluzione (relative sia alla larghezza che alla altezza) ponendo il risultato in `haveResolution`. Dopodichè questo array di playlist è ordinato in modo crescente di larghezza (e dunque di risoluzione) utilizzando la funzione [`stableSort`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22stableSort%22%5D "src/playlist-selectors.js").

Il codice poi cerca una rappresentazione che abbia esattamente la stessa risoluzione del player video. Se esistono delle rappresentazioni che soddisfano questa condizione, allora fra di queste viene selezionata quella con la banda più alta.

Se non esiste una rappresentazione con la stessa risoluzione del player, si cerca la rappresentazione più piccola che sia più grande del player. 
Questo viene fatto filtrando l'array `haveResolution` per trovare le rappresentazioni che hanno una larghezza (`width`) o un'altezza (`height`) maggiore di quella del player. Tra di queste si selezionano quelle con la risoluzione inferiore in termini di larghezza e poi fra questo ulteriore sottogruppo, viene selezionata quella con il bitrate più alto. Questa playlist è indicata come [`resolutionPlusOneRep`].

In sintesi, nella sezione descritta, viene selezionata la rappresentazione di playlist con la risoluzione più adatta alle dimensioni del player video e la banda più alta possibile in base alle condizioni di rete. 

Se il selettore `leastPixelDiffSelector` del `playlistController` è attivo, viene cercata la rappresentazione che ha la differenza di pixel più vicina alla dimensione del player. Questo viene fatto mappando l'array [`haveResolution`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22haveResolution%22%5D "src/playlist-selectors.js") per calcolare la differenza di pixel di ogni rappresentazione rispetto alla dimensione del player, e aggiungendo questa differenza come proprietà `pixelDiff` a ogni rappresentazione.
Successivamente, le rappresentazioni sono ordinate in termini di differenza di pixel rispetto al player crescente.
Se due rappresentazioni hanno la stessa differenza di pixel, vengono ordinate in maniera decrescente per bitrate.
La rappresentazione con la minima differenza di pixel e la banda più alta viene quindi assegnata a [`leastPixelDiffRep`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22leastPixelDiffRep%22%5D "src/playlist-selectors.js").


Nella sezione successiva è stabilita una catena di fallback per la scelta della rappresentazione. Se [`leastPixelDiffRep`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22leastPixelDiffRep%22%5D "src/playlist-selectors.js") è definita, viene scelta. Altrimenti, viene scelta la prima rappresentazione definita tra [`resolutionPlusOneRep`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22resolutionPlusOneRep%22%5D "src/playlist-selectors.js"), [`resolutionBestRep`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22resolutionBestRep%22%5D "src/playlist-selectors.js"), [`bandwidthBestRep`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22bandwidthBestRep%22%5D "src/playlist-selectors.js"), la prima rappresentazione dell'array [`enabledPlaylistReps`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22enabledPlaylistReps%22%5D "src/playlist-selectors.js"), e la prima rappresentazione dell'array [`sortedPlaylistReps`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22sortedPlaylistReps%22%5D "src/playlist-selectors.js").

Se la rappresentazione scelta e la relativa playlist sono definite, il codice registra il tipo di rappresentazione scelta e **restituisce la playlist della rappresentazione scelta**. Altrimenti, registra che non è stato possibile scegliere una playlist e restituisce `null`.

**Test only**

[`TEST_ONLY_SIMPLE_SELECTOR`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22TEST_ONLY_SIMPLE_SELECTOR%22%5D "src/playlist-selectors.js") è una funzione che permette di sostituire temporaneamente la funzione selettore corrente con una nuova, e fornisce un mezzo per ripristinare la funzione selettore originale quando necessario. Questo può essere utile per i test, permettendo di modificare il comportamento del selettore durante l'esecuzione di specifici test, e poi ripristinare il comportamento originale dopo.

## Playlist Selectors (versioni specializzate)

### lastBandwidthSelector

La funzione chiamata [`lastBandwidthSelector`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22lastBandwidthSelector%22%5D "src/playlist-selectors.js") è responsabile della **scelta** della playlist appropriata in base alla stima più recente della larghezza di banda e alla dimensione del player **tenendo in considerazione il rapporto di forma del dispositivo** (se `useDevicePixelRatio` è `true`, altrimenti utilizza `1`).
Essa restituisce il risultato della chiamata alla funzione [`simpleSelector`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22simpleSelector%22%5D "src/playlist-selectors.js"), passando i seguenti parametri:

1. `this.playlists.main`;
2. `this.systemBandwidth`
3. La larghezza del player, moltiplicata per il rapporto dei pixel. Questo valore viene ottenuto utilizzando la funzione [`safeGetComputedStyle`] per ottenere la larghezza del player, convertendola in un numero intero e moltiplicandola per il rapporto dei pixel.
4. L'altezza del player moltiplicata per il rapporto dei pixel. Questo valore viene ottenuto in modo analogo al punto precedente. 
5. `this.limitRenditionByPlayerDimensions`: un flag che indica se limitare la scelta della rappresentazione in base alle dimensioni del player.
6. `this.playlistController_`: il controller della playlist.

In sostanza, la differenza principale fra questo selettore e il [`simpleSelector`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22simpleSelector%22%5D "src/playlist-selectors.js") risiede nella altezza e la larghezza del player, che qui è moltiplicata per il [`pixelRatio`]

### movingAverageBandwidthSelector

Il selettore [`movingAverageBandwidthSelector`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22movingAverageBandwidthSelector%22%5D "src/playlist-selectors.js"), si basa nella **scelta** della playlist appropriata **sulla media mobile pesata esponenzialmente della larghezza di banda**, dopo aver filtrato per la dimensione del player.

La funzione prende un parametro numerico, `decay`, compreso tra 0 e 1, il quale verrà utilizzato nel calcolo della media mobile. 
Innanzitutto, dopo aver settato due costanti, viene effettuato un controllo preliminare: se `decay` non è compreso tra 0 e 1, la funzione restituisce un errore.
(N.B.  valori più alti di `decay` faranno perdere più rapidamente significato alle stime precedenti della larghezza di banda. )

Se la media è inferiore a 0, cosa che si verifica al primo utilizzo dal momento che essa è inizializzata a -1,  essa viene aggiornata con la larghezza di banda del sistema. La media viene poi aggiornata ogni volta che la larghezza di banda del sistema cambia e non è 0, utilizzando la formula per la media mobile pesata esponenzialmente:

```javascript
if (this.systemBandwidth > 0 && this.systemBandwidth !== lastSystemBandwidth) {
  average = decay * this.systemBandwidth + (1 - decay) * average;
  lastSystemBandwidth = this.systemBandwidth;
}
```

Infine, la funzione restituita chiama la funzione [`simpleSelector`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22simpleSelector%22%5D "src/playlist-selectors.js"), passando come banda la media appena calcolata.


### minBufferMaxBandwidthSelector

La funzione [`minRebufferMaxBandwidthSelector`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22minRebufferMaxBandwidthSelector%22%5D "src/playlist-selectors.js") ha il compito di **selezionare la playlist che minimizzi la potenziale necessità di rebuffering**.

La funzione riceve un oggetto `settings`, il quale contiene diverse proprietà utilizzate per determinare la playlist da selezionare, tra cui:
- [`main`], la rappresentazione del manifesto principale;
- [`currentTime`], il tempo attuale del player
- [`bandwidth`], la larghezza di banda misurata
- [`duration`], la durata del media;
- [`segmentDuration`], la durata del segmento (utilizzata per il calcolo dell'RTT);
- [`timeUntilRebuffer`], il tempo rimanente (in secondi) prima del rebuffering;
- [`currentTimeline`], la timeline corrente da cui vengono caricati i segmenti;
- [`syncController`], il controller di sincronizzazione.

All'interno della funzione, come prima cosa, vengono filtrate le playlist che sono state escluse a causa di configurazioni incompatibili. Successivamente, vengono filtrate le playlist che sono state disabilitate manualmente attraverso l'API o escluse temporaneamente a causa di errori di riproduzione.
Successivamente, vengono filtrate le playlist che possiedono l'attributo 'BANDWIDTH'. 
Per ciascuna di queste playlist, viene calcolato l'impatto del rebuffering, che è il tempo di rebuffering in secondi che il passaggio a questa playlist richiederebbe.
Per far ciò innanzitutto viene verifcato, per ognuna di queste playlist, se è presente un punto di sincronizzazione, in quanto, se questo non è presente, il passaggio alla playlist in questione richiederà prima una richiesta di sincronizzazione, raddoppiando il tempo di richiesta.
Dopodichè si calcola, per l'appunto il tempo di richiesta, [`requestTimeEstimate`], utilizzato per il  calcolo dell'impatto di rebuffering:

```javascript
const rebufferingImpact = (requestTimeEstimate * numRequests) - timeUntilRebuffer;
```
Dove [`numRequest`] è pari ad 1 se la playlist presenta un punto di sincronizzazione, 2 altrimenti.

Dunque, le playlist sono filtrate, mantenendo quelle che non presentano tempo di rebuffering. Se esistono playlist di questo tipo, queste sono ordinate per banda decrescente e viene scelta la playlist a banda più alta. 

Altrimenti, le playlist sono ordinate per impatto di rebuffering crescente e viene selezionata e restituita quella che richiede il minor tempo di rebuffering. 

Se non ci sono playlist disponibili, viene restituito `null`.


### lowestBitrateCompatibleVariantSelector 

[`lowestBitrateCompatibleVariantSelector`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22lowestBitrateCompatibleVariantSelector%22%5D "src/playlist-selectors.js") è l'ultimo selettore. 
Questa funzione è progettata per **scegliere la playlist con il bitrate più basso fra quelle contenenti video**. Se non esistono varianti con video, la funzione restituisce la variante audio con il bitrate più basso.

Questo inizia filtrando le playlist che sono state escluse a causa di configurazioni incompatibili o errori di riproduzione e successivamente le ordina per bitrate crescente utilizzando la funzione [`stableSort`].

Dopo l'ordinamento, la funzione filtra le playlist che non incorporano un video. Questo viene fatto assumendo che le playlist senza un codec video non abbiano video, il che non è necessariamente vero, ma è una buona approssimazione.

Infine, la funzione restituisce la prima playlist nell'array [`playlistsWithVideo`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-selectors.js%22%2C%22playlistsWithVideo%22%5D "src/playlist-selectors.js") (cioè, la playlist con il bitrate più basso che contiene video), se questa esiste, altrimenti restituisce `null`.