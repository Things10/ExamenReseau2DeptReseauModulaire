<?php
/* ============================================================
   REPONS OFISYEL YO — SE PA VLERE VOYE SOU NAVIGATEUR !
   File sa a prekosyon dwe rete apèsyen sèlman (soit kliyan an paka aksede a file yo).
   Sèvi l nan api/grade.php pou kalkile not automatique yo.
   ============================================================ */
declare(strict_types=1);

define('QCM_PTS', 1.25);
define('MULTI_PTS', 1.25);
define('QCM_COUNT', 8);
define('MULTI_COUNT', 8);

/* Repons SECTION A — Choisir la bonne réponse (1.25 pts chak) */
$QCM_ANSWERS = [
    "200.4.126.3",
    "/23",
    "Loopback",
    "/27",
    "62",
    "Ip route 192.168.10.0 255.255.255.0 10.0.0.1",
    "Ip route 192.168.30.0 255.255.255.0 10.1.1.10 5",
    "show ip ospf interface brief",
];

/* Repons SECTION B — Cochez toutes les réponses correctes (1.25 pts chak, tout-ou-rien) */
$MULTI_ANSWERS = [
    [
        "Elle a une distance administrative plus élevée que la route principale",
        "Elle prend effet uniquement quand la route principale est indisponible",
        "Elle est utilisée comme route de secours",
    ],
    [
        "L'adresse IP de la passerelle par défaut",
        "Le masque de sous-réseau",
        "L'adresse du serveur DNS",
        "La durée du bail (lease time)",
    ],
    [
        "Port 80 (HTTP)",
        "Port 443 (HTTPS)",
        "Port 22 (SSH)",
    ],
    [
        "Protocole à état de lien (link-state)",
        "Utilise l'algorithme de Dijkstra (SPF)",
        "Élit un routeur désigné (DR) sur les réseaux multi-accès",
    ],
    [
        "Création de SVI (Switch Virtual Interface)",
        "Routage inter-VLAN sans routeur externe",
        "Table de routage IP",
    ],
    [
        "Il nécessite une sous-interface par VLAN sur le routeur",
        "Il nécessite un lien trunk entre le switch et le routeur",
        "Il permet le routage inter-VLAN avec une seule interface physique",
    ],
    [
        "La commande globale « ip routing » doit être activée",
        "Les SVI (interface vlan 10 et interface vlan 30) doivent être en état « up/up »",
        "Les VLAN 10 et 30 doivent exister et avoir au moins un port actif associé",
    ],
    [
        "OSPF calcule le coût selon la bande passante de l'interface, EIGRP utilise une métrique composite (bande passante et délai par défaut)",
        "EIGRP converge généralement plus vite grâce à l'algorithme DUAL et aux routes de secours (feasible successor)",
        "EIGRP est un protocole à vecteur de distance avancé, OSPF un protocole à état de lien",
    ],
];