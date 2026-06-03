/*
 * rooms.js — Contenuti dell'Escape Room IT (livello Junior / formazione)
 *
 * Tutti i dati di gioco vivono qui, separati dal motore (game.js) così che
 * un formatore possa aggiungere o modificare enigmi senza toccare la logica.
 *
 * Schema di un enigma (puzzle):
 *   {
 *     id:        identificativo univoco (stringa)
 *     type:      'mc'    -> risposta singola a scelta multipla
 *                'multi' -> selezione multipla (più risposte corrette)
 *                'text'  -> risposta da digitare
 *     question:  testo della domanda
 *     options:   array di opzioni            (solo per 'mc' e 'multi')
 *     answer:    indice corretto (numero)    (per 'mc')
 *                array di indici corretti     (per 'multi')
 *     accept:    array di risposte accettate  (solo per 'text', confronto normalizzato)
 *     placeholder: testo guida del campo      (solo per 'text')
 *     pre:       blocco di testo monospazio mostrato prima della domanda (opzionale, es. un log)
 *     hints:     array di indizi progressivi
 *     explanation: spiegazione didattica mostrata dopo la risoluzione
 *   }
 *
 * Schema di una stanza (room):
 *   { id, title, subtitle, icon (SVG), color, fragment (frammento chiave), intro, puzzles[] }
 */

(function () {
  "use strict";

  // --- Icone SVG (inline, nessun file esterno) ---------------------------
  const ICONS = {
    storage:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="12" width="18" height="5" rx="1"/><circle cx="7" cy="6.5" r="0.6" fill="currentColor"/><circle cx="7" cy="14.5" r="0.6" fill="currentColor"/><line x1="11" y1="6.5" x2="18" y2="6.5"/><line x1="11" y1="14.5" x2="18" y2="14.5"/></svg>',
    virtualization:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="15" x2="4" y2="15"/><line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="15" x2="22" y2="15"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/></svg>',
    network:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><line x1="12" y1="7.2" x2="12" y2="12"/><line x1="12" y1="12" x2="6.2" y2="17.4"/><line x1="12" y1="12" x2="17.8" y2="17.4"/></svg>',
    security:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9.5 12l1.8 1.8L15 10"/></svg>',
  };

  // --- Le quattro zone ----------------------------------------------------
  const ROOMS = [
    // =====================================================================
    // 1) STORAGE
    // =====================================================================
    {
      id: "storage",
      title: "Zona 1 — Storage",
      subtitle: "Dischi, RAID e protocolli",
      icon: ICONS.storage,
      color: "#22d3ee",
      fragment: "RD1",
      intro:
        "Sei il tecnico di turno notturno. Un allarme ha messo il datacenter in lockdown e le porte si sono bloccate. " +
        "La prima zona è la sala storage: dimostra di saper gestire dischi e array per recuperare il primo frammento della chiave maestra.",
      puzzles: [
        {
          id: "st1",
          type: "mc",
          question:
            "Due dischi da 4 TB sono configurati in RAID 1 (mirroring). Qual è la capacità totale UTILIZZABILE?",
          options: ["8 TB", "4 TB", "2 TB", "16 TB"],
          answer: 1,
          hints: [
            "Nel RAID 1 i dati vengono copiati identici su entrambi i dischi.",
            "Se i due dischi contengono la stessa identica copia, lo spazio utile è quello di UN solo disco.",
          ],
          explanation:
            "RAID 1 = mirroring: i dati sono duplicati su entrambi i dischi, quindi la capacità utile equivale a un solo disco (4 TB). " +
            "Si \"perde\" metà dello spazio in cambio della protezione dal guasto di un disco.",
        },
        {
          id: "st2",
          type: "mc",
          question:
            "Quale livello RAID NON offre alcuna ridondanza, ma massimizza prestazioni e capacità?",
          options: ["RAID 0", "RAID 1", "RAID 5", "RAID 6"],
          answer: 0,
          hints: [
            "Cerca il livello che divide i dati su più dischi senza tenere copie o parità.",
            "È spesso chiamato 'striping'. Numero più basso possibile.",
          ],
          explanation:
            "RAID 0 (striping) distribuisce i dati su più dischi senza copie né parità: è veloce e usa tutto lo spazio, " +
            "ma se anche UN solo disco si guasta si perdono TUTTI i dati. Zero ridondanza.",
        },
        {
          id: "st3",
          type: "mc",
          question:
            "RAID 5 con 4 dischi da 2 TB ciascuno (parità distribuita, equivalente a 1 disco). Quanta capacità utile ottieni?",
          options: ["8 TB", "6 TB", "4 TB", "2 TB"],
          answer: 1,
          hints: [
            "Nel RAID 5 lo spazio equivalente a 1 disco è 'consumato' dalla parità.",
            "Capacità = (numero dischi − 1) × dimensione disco.",
          ],
          explanation:
            "RAID 5 usa l'equivalente di 1 disco per la parità: (4 − 1) × 2 TB = 6 TB utili. " +
            "Sopravvive al guasto di 1 disco ricostruendo i dati dalla parità.",
        },
        {
          id: "st4",
          type: "multi",
          question:
            "Quali di queste sono tecnologie/protocolli per accedere allo STORAGE in rete? (selezionane tutte quelle corrette)",
          options: ["iSCSI", "NFS", "SMB/CIFS", "SMTP"],
          answer: [0, 1, 2],
          hints: [
            "Uno di questi serve a inviare email, non a leggere file o dischi.",
            "SMTP = Simple Mail Transfer Protocol: nulla a che vedere con lo storage.",
          ],
          explanation:
            "iSCSI espone dischi a blocchi via rete; NFS (mondo Unix/Linux) e SMB/CIFS (mondo Windows) condividono file. " +
            "SMTP invece è il protocollo della posta elettronica: non c'entra con lo storage.",
        },
        {
          id: "st5",
          type: "mc",
          question:
            "Un collega dice: «Ho fatto uno snapshot della VM prima dell'aggiornamento». Cos'è uno snapshot?",
          options: [
            "Un backup definitivo su nastro",
            "Una 'fotografia' dello stato in un dato istante, per poter tornare indietro",
            "Un secondo disco fisico aggiunto al server",
            "Un livello RAID particolare",
          ],
          answer: 1,
          hints: [
            "La parola 'snapshot' significa letteralmente 'istantanea/fotografia'.",
            "Serve a ripristinare rapidamente lo stato precedente se qualcosa va storto.",
          ],
          explanation:
            "Lo snapshot cattura lo stato di una VM (dati + configurazione) in un preciso momento. Se l'aggiornamento fallisce, " +
            "puoi ripristinare quello stato in pochi secondi. ATTENZIONE: non sostituisce un vero backup, perché vive sullo stesso storage.",
        },
      ],
    },

    // =====================================================================
    // 2) VIRTUALIZZAZIONE
    // =====================================================================
    {
      id: "virtualization",
      title: "Zona 2 — Virtualizzazione",
      subtitle: "Hypervisor, VM e container",
      icon: ICONS.virtualization,
      color: "#a78bfa",
      fragment: "VM2",
      intro:
        "Porta sbloccata! Entri nella sala dei server di virtualizzazione: decine di macchine virtuali girano su pochi host fisici. " +
        "Rispondi correttamente per ottenere il secondo frammento.",
      puzzles: [
        {
          id: "vt1",
          type: "mc",
          question: "Cos'è un hypervisor?",
          options: [
            "Un firewall di nuova generazione",
            "Il software che crea ed esegue le macchine virtuali",
            "Un livello RAID ad alte prestazioni",
            "Un protocollo di rete sicuro",
          ],
          answer: 1,
          hints: [
            "Pensa a cosa permette di far girare più sistemi operativi sullo stesso server fisico.",
            "È lo strato che 'astrae' l'hardware e lo condivide tra le VM.",
          ],
          explanation:
            "L'hypervisor astrae l'hardware fisico (CPU, RAM, dischi, rete) e permette di eseguire più macchine virtuali isolate " +
            "sullo stesso server. È il cuore della virtualizzazione.",
        },
        {
          id: "vt2",
          type: "mc",
          question:
            "Qual è la differenza principale tra hypervisor di Tipo 1 e di Tipo 2?",
          options: [
            "Il Tipo 1 gira direttamente sull'hardware (bare-metal), il Tipo 2 gira sopra un sistema operativo",
            "Il Tipo 1 è gratuito, il Tipo 2 è a pagamento",
            "Il Tipo 1 funziona solo con Linux",
            "Non c'è alcuna differenza pratica",
          ],
          answer: 0,
          hints: [
            "La distinzione riguarda 'dove' viene installato l'hypervisor.",
            "'Bare-metal' significa direttamente sul ferro, senza un SO sotto.",
          ],
          explanation:
            "Tipo 1 (bare-metal): installato direttamente sull'hardware, è quello dei datacenter (ESXi, Hyper-V, KVM/Proxmox). " +
            "Tipo 2: gira come applicazione dentro un SO già installato (VirtualBox, VMware Workstation), tipico di desktop e laboratori di test.",
        },
        {
          id: "vt3",
          type: "multi",
          question:
            "Quali tra questi sono hypervisor di Tipo 1 (bare-metal)? (selezionane tutti)",
          options: [
            "VMware ESXi",
            "Microsoft Hyper-V",
            "KVM (Linux)",
            "Oracle VirtualBox",
          ],
          answer: [0, 1, 2],
          hints: [
            "Uno di questi si installa DENTRO Windows o macOS come una normale applicazione.",
            "VirtualBox lo apri come un programma sul tuo PC: che tipo è?",
          ],
          explanation:
            "ESXi, Hyper-V e KVM girano direttamente sull'hardware (Tipo 1). VirtualBox è di Tipo 2: " +
            "è un'applicazione che esegui dentro un sistema operativo già avviato.",
        },
        {
          id: "vt4",
          type: "mc",
          question:
            "Qual è la differenza tra una macchina virtuale (VM) e un container (es. Docker)?",
          options: [
            "Sono esattamente la stessa cosa",
            "La VM virtualizza l'intero hardware con un SO completo; il container condivide il kernel dell'host ed è più leggero",
            "Il container è sempre più pesante di una VM",
            "La VM non può eseguire Linux",
          ],
          answer: 1,
          hints: [
            "Una delle due soluzioni include un intero sistema operativo, l'altra no.",
            "Il container 'prende in prestito' il kernel dal sistema che lo ospita.",
          ],
          explanation:
            "Una VM contiene un sistema operativo completo e isolato: più pesante ma molto isolata. Un container impacchetta solo " +
            "l'applicazione con le sue librerie e condivide il kernel dell'host: avvio quasi istantaneo e meno risorse consumate.",
        },
        {
          id: "vt5",
          type: "mc",
          question:
            "Sposti una VM ACCESA da un host fisico a un altro senza spegnerla né interrompere il servizio. Come si chiama?",
          options: [
            "Hot-plug",
            "Live migration (es. vMotion)",
            "Snapshot",
            "Failover del RAID",
          ],
          answer: 1,
          hints: [
            "La parola chiave è 'in esecuzione, senza spegnere'.",
            "In VMware questa funzione si chiama vMotion.",
          ],
          explanation:
            "La live migration (vMotion in VMware, Live Migration in Hyper-V) trasferisce una VM in esecuzione tra due host " +
            "senza interruzione percepibile: utilissima per fare manutenzione su un server senza fermare i servizi.",
        },
      ],
    },

    // =====================================================================
    // 3) NETWORK
    // =====================================================================
    {
      id: "network",
      title: "Zona 3 — Network",
      subtitle: "IP, subnet, porte e routing",
      icon: ICONS.network,
      color: "#34d399",
      fragment: "NW3",
      intro:
        "Sala apparati di rete: switch e router lampeggiano nel buio. Per attraversarla devi padroneggiare indirizzi IP, " +
        "subnet e porte. Ottieni il terzo frammento.",
      puzzles: [
        {
          id: "nw1",
          type: "mc",
          question:
            "Quale di questi è un indirizzo IP PRIVATO (RFC 1918), quindi non instradabile su Internet?",
          options: ["8.8.8.8", "192.168.1.10", "200.10.10.1", "1.1.1.1"],
          answer: 1,
          hints: [
            "Gli indirizzi privati iniziano con 10. , 172.16–31. oppure 192.168.",
            "8.8.8.8 e 1.1.1.1 sono famosi server DNS PUBBLICI.",
          ],
          explanation:
            "Gli indirizzi privati (RFC 1918) sono: 10.0.0.0/8, 172.16.0.0/12 e 192.168.0.0/16. " +
            "192.168.1.10 rientra nell'ultimo intervallo. 8.8.8.8 e 1.1.1.1 sono DNS pubblici, 200.10.10.1 è un IP pubblico.",
        },
        {
          id: "nw2",
          type: "mc",
          question:
            "Una rete con maschera /24 (255.255.255.0): quanti indirizzi host UTILIZZABILI mette a disposizione?",
          options: ["256", "254", "255", "253"],
          answer: 1,
          hints: [
            "Un /24 contiene 256 indirizzi totali, ma due sono riservati.",
            "Si tolgono l'indirizzo di rete (.0) e quello di broadcast (.255): 256 − 2.",
          ],
          explanation:
            "Un /24 ha 2^(32−24) = 256 indirizzi. Due sono riservati (rete .0 e broadcast .255), quindi restano 254 host utilizzabili. " +
            "Formula generale: 2^(32 − prefisso) − 2.",
        },
        {
          id: "nw3",
          type: "mc",
          question: "Su quale porta TCP lavora di default HTTPS?",
          options: ["80", "443", "22", "25"],
          answer: 1,
          hints: [
            "HTTP usa la 80; la versione cifrata usa un numero diverso.",
            "È la porta del 'lucchetto' nel browser.",
          ],
          explanation:
            "HTTPS = porta 443 (HTTP cifrato con TLS). Da ricordare a memoria: HTTP 80, HTTPS 443, SSH 22, SMTP 25. " +
            "Conoscere le porte comuni è indispensabile per firewall e troubleshooting.",
        },
        {
          id: "nw4",
          type: "multi",
          question:
            "Quali abbinamenti servizio → porta sono CORRETTI? (selezionane tutti)",
          options: ["SSH → 22", "DNS → 53", "RDP → 3389", "FTP → 8080"],
          answer: [0, 1, 2],
          hints: [
            "Uno degli abbinamenti è sbagliato.",
            "FTP non usa la 8080 (che è una porta HTTP alternativa): usa la 21.",
          ],
          explanation:
            "Corretti: SSH 22, DNS 53, RDP 3389. Sbagliato: FTP usa la porta 21 (e la 20 per i dati). " +
            "La 8080 è invece una tipica porta HTTP alternativa.",
        },
        {
          id: "nw5",
          type: "mc",
          question:
            "Nella rete 192.168.10.0/24, qual è l'indirizzo di BROADCAST?",
          options: [
            "192.168.10.0",
            "192.168.10.1",
            "192.168.10.255",
            "192.168.10.254",
          ],
          answer: 2,
          hints: [
            "In un /24 il broadcast è sempre l'ULTIMO indirizzo della rete.",
            "Gli host vanno da .1 a .254; il .0 è la rete, il .255 è...",
          ],
          explanation:
            "In un /24 il primo indirizzo (.0) identifica la rete e l'ultimo (.255) è il broadcast (raggiunge tutti gli host della rete). " +
            "Gli indirizzi assegnabili agli host vanno quindi da .1 a .254.",
        },
        {
          id: "nw6",
          type: "mc",
          question:
            "Un PC ha IP, maschera e DNS corretti ma non riesce a navigare su Internet (la LAN però funziona). Quale parametro è probabilmente errato o mancante?",
          options: [
            "Il default gateway",
            "Il nome host del PC",
            "La porta 443",
            "La configurazione RAID",
          ],
          answer: 0,
          hints: [
            "Cosa serve per uscire dalla rete locale e raggiungere reti esterne?",
            "È l'indirizzo del router che fa da 'porta verso l'esterno'.",
          ],
          explanation:
            "Il default gateway è l'indirizzo del router che inoltra il traffico fuori dalla rete locale. Senza un gateway corretto " +
            "riesci a comunicare dentro la LAN, ma non puoi raggiungere Internet.",
        },
      ],
    },

    // =====================================================================
    // 4) SECURITY
    // =====================================================================
    {
      id: "security",
      title: "Zona 4 — Security",
      subtitle: "CIA, cifratura, phishing e log",
      icon: ICONS.security,
      color: "#f87171",
      fragment: "SC4",
      intro:
        "Ultima zona: la sala sicurezza, dove convergono log e allarmi. Dimostra di saper riconoscere minacce e proteggere i sistemi " +
        "per ottenere il quarto e ultimo frammento della chiave maestra.",
      puzzles: [
        {
          id: "sc1",
          type: "mc",
          question:
            "Nella sicurezza informatica, la triade 'CIA' sta per...",
          options: [
            "Confidentiality, Integrity, Availability",
            "Central Intelligence Agency",
            "Control, Inspect, Audit",
            "Cipher, Index, Access",
          ],
          answer: 0,
          hints: [
            "Sono i tre obiettivi fondamentali da garantire sui dati.",
            "In italiano: Riservatezza, Integrità, Disponibilità.",
          ],
          explanation:
            "CIA = Confidentiality (riservatezza), Integrity (integrità) e Availability (disponibilità): " +
            "i tre pilastri su cui si basa qualunque ragionamento di sicurezza.",
        },
        {
          id: "sc2",
          type: "mc",
          question:
            "Qual è la differenza fondamentale tra HASHING e CIFRATURA (encryption)?",
          options: [
            "Sono due nomi per la stessa cosa",
            "L'hashing è a senso unico (non reversibile); la cifratura è reversibile con la chiave giusta",
            "L'hashing è più sicuro perché usa sempre una password",
            "La cifratura è a senso unico, l'hashing no",
          ],
          answer: 1,
          hints: [
            "Una delle due operazioni si può 'annullare' se possiedi la chiave.",
            "Dall'hash NON puoi risalire al dato originale; dal testo cifrato sì, con la chiave.",
          ],
          explanation:
            "L'hashing (es. SHA-256) produce un'impronta a lunghezza fissa NON reversibile: si usa per verificare password e integrità. " +
            "La cifratura (es. AES) protegge i dati ma è reversibile: con la chiave corretta si torna al testo in chiaro.",
        },
        {
          id: "sc3",
          type: "multi",
          question:
            "Quali sono segnali tipici di un'email di PHISHING? (selezionane tutti)",
          options: [
            "Senso di urgenza ('il tuo account sarà bloccato tra 24 ore!')",
            "Mittente con dominio sospetto o scritto male",
            "Link il cui indirizzo reale è diverso dal testo mostrato",
            "Una firma digitale valida del tuo collega",
          ],
          answer: [0, 1, 2],
          hints: [
            "Tre sono campanelli d'allarme, uno invece è un segnale di autenticità.",
            "Una firma digitale valida conferma l'identità: NON è un segnale di phishing.",
          ],
          explanation:
            "Urgenza artificiale, domini sbagliati e link ingannevoli sono classici segnali di phishing. Una firma digitale valida, " +
            "al contrario, è un elemento di fiducia. Nel dubbio: non cliccare e verifica per un altro canale.",
        },
        {
          id: "sc4",
          type: "mc",
          question: "Cos'è la MFA (Multi-Factor Authentication)?",
          options: [
            "Semplicemente una password molto lunga",
            "L'uso di due o più fattori indipendenti (es. password + codice da app)",
            "Un tipo di antivirus",
            "Un modello di firewall",
          ],
          answer: 1,
          hints: [
            "La parola chiave è 'multi-factor': più di un fattore.",
            "Combina qualcosa che SAI con qualcosa che HAI (o che SEI).",
          ],
          explanation:
            "La MFA richiede almeno due fattori indipendenti: 'qualcosa che sai' (password), 'qualcosa che hai' (telefono/token) o " +
            "'qualcosa che sei' (impronta). Anche se un attaccante ruba la password, senza il secondo fattore non entra.",
        },
        {
          id: "sc5",
          type: "text",
          question:
            "Analizza questo estratto del log degli accessi SSH. Digita l'indirizzo IP che sta quasi certamente tentando un attacco brute-force:",
          pre:
            "10.0.0.5      login OK      (utente: mario)\n" +
            "185.23.44.9   FAILED        (password errata - root)\n" +
            "185.23.44.9   FAILED        (password errata - root)\n" +
            "185.23.44.9   FAILED        (password errata - admin)\n" +
            "185.23.44.9   FAILED        (password errata - admin)\n" +
            "185.23.44.9   FAILED        (password errata - test)\n" +
            "10.0.0.8      login OK      (utente: lucia)",
          accept: ["185.23.44.9"],
          placeholder: "es. 10.20.30.40",
          hints: [
            "Cerca l'IP con tanti tentativi FALLITI consecutivi.",
            "Un attacco brute-force prova molte password su utenti diversi (root, admin, test) dallo stesso indirizzo.",
          ],
          explanation:
            "L'IP 185.23.44.9 colleziona molti tentativi falliti di seguito provando utenti comuni (root, admin, test): è la firma " +
            "classica di un attacco brute-force. Va bloccato, ad esempio con fail2ban o una regola sul firewall.",
        },
        {
          id: "sc6",
          type: "mc",
          question:
            "Il principio del 'least privilege' (privilegio minimo) significa...",
          options: [
            "Dare a ogni utente solo i permessi strettamente necessari al suo lavoro",
            "Usare sempre l'account amministratore per comodità",
            "Disattivare le password per velocizzare gli accessi",
            "Dare a tutti accesso completo a ogni sistema",
          ],
          answer: 0,
          hints: [
            "Si tratta di concedere il MINIMO indispensabile.",
            "Meno permessi ha un account, minori sono i danni se viene compromesso.",
          ],
          explanation:
            "Il privilegio minimo prevede di assegnare a ogni utente o servizio solo i permessi indispensabili. Così, se un account " +
            "viene compromesso, l'attaccante può fare molti meno danni. È uno dei principi cardine della sicurezza.",
        },
      ],
    },
  ];

  // --- Metadati generali e schermata finale ------------------------------
  const META = {
    title: "ESCAPE ROOM IT",
    subtitle: "Lockdown in Datacenter",
    // La chiave maestra è la concatenazione dei frammenti, nell'ordine delle zone.
    masterKey: "RD1-VM2-NW3-SC4",
    // Forme accettate per la chiave finale (vengono normalizzate: maiuscole, senza spazi).
    masterAccept: ["RD1-VM2-NW3-SC4", "RD1VM2NW3SC4"],
    ranks: [
      { min: 900, label: "Tecnico IT Certificato — Eccellente", medal: "🥇" },
      { min: 700, label: "Tecnico Junior Promosso", medal: "🥈" },
      { min: 500, label: "Apprendista Promettente", medal: "🥉" },
      { min: 0, label: "Missione completata — ripassa e riprova!", medal: "🎓" },
    ],
    scoring: {
      start: 1000, // punteggio iniziale
      hintCost: 15, // punti persi per ogni indizio rivelato
      wrongCost: 10, // punti persi per ogni risposta errata
    },
  };

  // Esposizione globale per game.js (script classici, nessun bundler).
  window.ESCAPE_DATA = { rooms: ROOMS, meta: META, icons: ICONS };
})();
