# PLAYLIST CONTROLLER

Il [Playlist Controller](../src/playlist-controller.js) ([source](https://github.com/videojs/http-streaming/blob/main/src/playlist-controller.js)) di [`videojs-http-streaming`][vhs] è un componente fondamentale per la gestione della riproduzione video all'interno delle applicazioni web.

## Obiettivi

Il file integra una moltitudine di funzionalità differenti che contribuiscono ad una ottimale riproduzione del contenuto. Fra queste abbiamo: 
1.  Valutazione della necessità di cambiare playlist, e dunque qualità video, in base alle condizioni di rete e alla porzione di buffer occupato;
2. Gestione della riproduzione di contenuti live ed adattare le varie funzionalità a questo tipo di media;
3. Gestione degli eventi durante la riproduzione; 
4. Gestione del content steering. 
5. Gestione delle tracce audio, nel caso in cui audio e video non siano combinati.
6. Gestione dei metadati e dei cue tags. 

## Analisi dettagliata del codice

### shouldSwitchToMedia

La funzione [`shouldSwitchToMedia`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-controller.js%22%2C%22shouldSwitchToMedia%22%5D "src/playlist-controller.js") valuta se è opportuno che il video player passi ad una diversa playlist, in base alle condizioni di riproduzione e buffering.

La funzione accetta in input un oggetto con le seguenti proprietà: 

- [`currentPlaylist`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-controller.js%22%2C%22currentPlaylist%22%5D "src/playlist-controller.js"): La playlist che è in riproduzione; 
- [`buffered`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-controller.js%22%2C%22buffered%22%5D "src/playlist-controller.js"): L'intervallo di video che è stato bufferizzato ed è pronto per la riproduzione; 
- [`currentTime`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-controller.js%22%2C%22currentTime%22%5D "src/playlist-controller.js"): Il tempo attuale di riproduzione del video.
- [`nextPlaylist`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-controller.js%22%2C%22nextPlaylist%22%5D "src/playlist-controller.js"): La playlist alla quale passare (eventualmente).
- [`bufferLowWaterLine`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-controller.js%22%2C%22bufferLowWaterLine%22%5D "src/playlist-controller.js") e [`bufferHighWaterLine`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-controller.js%22%2C%22bufferHighWaterLine%22%5D "src/playlist-controller.js"): Soglie del buffer. Se il contenuto bufferizzato in termini di tempo del video scende al di sotto di HighWaterLine il player passa ad una playlist di qualità inferiore e viceversa, se il tempo bufferizzato sale al di sopra di LowWaterLine il player potrebbe passare ad una playlist di qualità superiore. 
- [`duration`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-controller.js%22%2C%22duration%22%5D "src/playlist-controller.js"): Durata totale del video. 
- [`bufferBasedABR`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-controller.js%22%2C%22bufferBasedABR%22%5D "src/playlist-controller.js"): Flag riguardo l'utilizzo di ABR (adaptive bitrate) di tipo buffer based, che regola la qualità video in base alle condizioni del buffer del video player (e quindi non solo in termini di larghezza di banda).    
- [`log`](command:_github.copilot.openSymbolInFile?%5B%22src%2Fplaylist-controller.js%22%2C%22log%22%5D "src/playlist-controller.js"): Messaggi di logging. 

Controlli preliminari: 
- Se non è fornita una playlist sulla quale spostarsi (`nextPlaylist` è null o undefined), viene inserito un messaggio di warning nel log e viene restituito 'false', indicando che non verrà effettuato il passaggio alla nuova playlist. 
- Se non è presente una playlist attuale (`currentPlaylist` è falso), la funzione logga che sta autorizzando il passaggio alla nuova playlist e ritorna 'true'.
- Se le due playlist (attuale e prossima) coincidono, non è necessario effettuare uno switch (viene restituito false); 
- Se il [`currentTime`] è in un range bufferizzato, `isBuffered` è settato a 'true';

Dopodichè viene verificato se si tratta di un contenuto in diretta. 
In tal caso, infatti, la `bufferLowWaterLine` non è considerata.
Questa verifica consiste nel controllare se `currentPlaylist.endList` è falsa. 
Se si tratta di una trasmissione LLHLS (Low-Latency-HLS) e il playback non è iniziato (`isBuffered` falso), logga che lo switch di qualità non è autorizzato. 

Dunque è calcolato il `forwardBuffer`, cioè il tempo di video bufferizzato dopo il `currentTime` e in seguito calcolato il `MaxBufferLowWaterLine`. Questo può variare a seconda del fatto che sia utilizzato un ABR  di tipo buffer based o meno. 
Dopo è presente un ulteriore controllo: 
- se la durata del video è al di sotto di `MaxBufferLowWaterLine`, il cambio playlist è autorizzato in quanto, in analogia col caso di un live video, il player potrebbe non passare mai ad una playlist a qualità superiore. 

Successivamente vengono entratti i valori di banda (bitrate) della playlist corrente [`currBandwidth`] e della successiva [`nextBandwidth`], cioè la quantità di dati che le due playlist trasmettono per unità di tempo. 

E' presente poi una serie di if che determinano se è opportuno cambiare playlist in base allo stato del buffer:
- Se il livello della playlist successiva è **inferiore** rispetto a quello della playlist corrente (vale a dire `nextBandwidth`<`currBandwidth`) e contestualmente si verifica almeno una delle seguenti condizioni: 
    
    - non é in utilizzo un ABR buffer based (`!bufferBasedABR` è true);
    - la porzione di video bufferizzata è al di sotto di una soglia detta `bufferHighWaterLine`

    allora il buffer si sta svuotando troppo. Risulta quindi opportuno fare uno switch down, cioè passare alla prossima playlist che è di qualità inferiore, in modo da aumentare la quantità di video che siamo in grado di bufferizzare. Viene quindi registrato un messaggio di log che notifica tutto ciò e viene restituito true (è possibile effettuare lo switch). 

If true && (false || true) ->> true 
Buffer based attivo, dati sotto soglia, playlist successiva a qualità inferiore ->> passo alla playlist successiva

If true && (true || false) ->> true
Buffer based disattivo, dati sopra soglia, qualità inferiore ->> 


- Se il livello della playlist successiva è **superiore** rispetto a quello della playlist corrente (vale a dire `nextBandwidth`>`currBandwidth`) e contestualmente si verifica almeno una delle seguenti condizioni: 
    
    - non é in utilizzo un ABR buffer based (`!bufferBasedABR` è true);
    - la porzione di video bufferizzata è al di sopra di una soglia detta `bufferLowWaterLine`

    allora il buffer si sta riempiendo troppo e risulta opportuno fare uno **switch up**, cioè passare alla prossima playlist che è di qualità superiore. Viene quindi registrato un messaggio di log che notifica tutto ciò e viene restituito true (è possibile effettuare lo switch). 

- alternativamente, viene loggato che lo switch non verrà effettuato per via del fatto che i criteri di switching non sono stati soddisfatti. 

...

Viene poi creato un `contentSteeringController` passando un oggetto che gestisce chiamate http (per richiedere i segmenti) e la funzione per ricavare la banda corrente. 
Viene poi richiamato l'ascoltatore d'eventi per il Segment Steering. 
Infine se è attivo l'ABR bufferbased, ogni qual volta viene caricata la playlist oppure il video viene messo in play, viene avviato un timer ABR, mentre quando il video è stoppato, viene contestualmente stoppato anche il timer ABR. 

...

Nella sezione successiva è presente la definizione di due metodi principali: 
- [`checkABR_()`] realizza l'ABR e riceve in ingresso un parametro [`reason`], che indica la motivazione sulla base della quale stiamo effettuando questo controllo e che ha come valore di default 'abr'.  
Viene quindi richimato il metodo `selectPlaylist()` per selezionare la prossima playlist da riprodurre.
Dunque, se esiste una prossima playlist e se `shouldSwitchToMedia_()` restituisce esito positivo quando chiamata passando la prossima playlist come argomento, allora viene chimata la funzione `switchMedia_()`, che è definita subito dopo, con argomenti la prossima playlist e la motivazione. 

- [`switchMedia_()`] è responsabile del cambio vero e proprio del media corrente con il successivo, specificato tramite la playlist passata come argomento. 
Questo metodo accetta tre argomenti in input: una playlist, una motivazione e un ritardo. 
All'interno del metodo vengono poi settate delle costanti, in particolare: 
   - `oldMedia` e `oldId`, rispettivamente il contenuto attualmente in riproduzione e il suo identificatore
   - `newId`, l'identificatore della playlist seguente. 

Dunque, se l'identificatore della playlist successiva non è nullo ed è diverso da quello della playlist corrente, allora viene loggato lo switch e viene triggerato il cambio.
Infine, il nuovo media viene caricato nella playlist principale.  

Viene definito il metodo [`startABRTimer_()`], che si occupa di effettuare una chiamata a `checkABR_()` ogni 250 millisecondi. Prima di fare ciò, esso si assicura che tutti gli altri timer attivi siano disattivati, in modo che al momento della chiamata del metodo `checkABR_()` ci sia sempre e solo un timer attivo. 

E' presente poi un metodo che si occupa di stoppare il timer, cioè [`stopABRTimer_()`].


#### Private `shouldSwitchToMedia`

Viene definito un metodo privato `shouldSwitchToMedia_()`, che è utilizzato solo all'interno della classe corrente e non può essere richiamato direttamente dall'esterno. 
Questo metodo accetta come parametro una `nextPlaylist` e setta alcuni parametri fra i quali anche il `currentTime` e le soglie di High Water e Low Water, nonchè la porzione di video bufferizzata e ritorna una chiamata a `shouldSwitchToMedia` passando questi parametri insieme ad altri.

...


E' presente anche la definizione del metodo [`goalBufferLength`], il quale calcola la dimensione desiderata del forward buffer (in termini di tempo in secondi) basandosi sul tempo corrente (istante in riproduzione), ottenuto tramite il metodo [`currentTime`].
N.B. Il valore calcolato non può superare un valore massimo definito nella configurazione.


## SOGLIE HIGH E LOW WATER 

#### **Definizione di [`bufferLowWaterLine`] e [`bufferHighWaterLine`]**

Il metodo [`bufferLowWaterLine`] calcola la "linea di bassa marea" del buffer, che è il punto che il buffer dovrebbe cercare di raggiungere durante la riproduzione. Anche questo metodo si basa sul tempo corrente e utilizza una formula simile a quella del metodo [`goalBufferLength`]. Tuttavia, questo metodo ha la possibilità di utilizzare un valore massimo sperimentale se la proprietà [`bufferBasedABR`] è vera.

Il metodo [`bufferHighWaterLine`] restituisce semplicemente un valore predefinito dalla configurazione. Questo valore rappresenta la "linea di alta marea" del buffer, che è il punto al di sopra del quale il buffer dovrebbe cercare di rimanere durante la riproduzione.

