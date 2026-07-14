/** Der Richter — DE pool. CULTURE-REWRITE, not a translation 
 * content exemption: the German Judge is a civil servant of morality.
 * Formal Sie throughout. Line count independent of EN by design. */
import type { CommentLine } from "./comments-en";

export const COMMENTS_DE: CommentLine[] = [
  // rescue_completed
  { id: "de-rc1", trigger: "rescue_completed", band: "any", text: "Eine Rettung. Wurde vermerkt. Ohne Gewähr." },
  { id: "de-rc2", trigger: "rescue_completed", band: "menace", text: "Plötzlich Tierfreund? Ihr Antrag auf Gewissensänderung liegt zur Prüfung vor." },
  { id: "de-rc3", trigger: "rescue_completed", band: "hero", text: "Erneut eine Rettung. Ihre Akte wird langsam verdächtig sauber." },
  { id: "de-rc4", trigger: "rescue_completed", band: "whisperer", text: "Eine randalierende Kuh, die Katzen rettet. Das Amt hat dafür kein Formular." },
  { id: "de-rc5", trigger: "rescue_completed", band: "enthusiast", text: "Eine gute Tat. Das Verhältnis bleibt dennoch eindeutig." },
  // rescue_ignored
  { id: "de-ri1", trigger: "rescue_ignored", band: "any", text: "Sie haben den Hund gesehen. Der Hund hat Sie gesehen. Vorgang geschlossen." },
  { id: "de-ri2", trigger: "rescue_ignored", band: "menace", text: "Nicht einmal verlangsamt. Die Routine wurde zur Kenntnis genommen." },
  { id: "de-ri3", trigger: "rescue_ignored", band: "hero", text: "Dieser passte wohl nicht ins Heiligenbild. Wurde dokumentiert." },
  { id: "de-ri4", trigger: "rescue_ignored", band: "flexible", text: "Nicht zuständig, verstehe. Sie sind erstaunlich oft nicht zuständig." },
  // hesitation — der Lieblingsvorgang des Richters
  { id: "de-h1", trigger: "hesitation", band: "any", text: "Sie hielten an. Sie erwogen. Sie gingen. Alle drei Schritte sind aktenkundig." },
  { id: "de-h2", trigger: "hesitation", band: "any", text: "Das Zögern wurde protokolliert. Es ist das ehrlichste Dokument in Ihrer Akte." },
  { id: "de-h3", trigger: "hesitation", band: "menace", text: "Fast. Irgendwo in Ihnen arbeitet noch eine Restinstanz." },
  { id: "de-h4", trigger: "hesitation", band: "hero", text: "Auch Sie haben einen Preis. Heute betrug er vier Sekunden." },
  { id: "de-h5", trigger: "hesitation", band: "flexible", text: "Sie bewerben sich weiterhin auf beide Stellen. Das Amt bittet um Entscheidung." },
  // child_scared
  { id: "de-cs1", trigger: "child_scared", band: "any", text: "Kinder erschreckt. Ihr Verhalten wurde dokumentiert." },
  { id: "de-cs2", trigger: "child_scared", band: "any", text: "Kinder führen kein Bier mit sich. Nur zur Information." },
  { id: "de-cs3", trigger: "child_scared_x3", band: "any", text: "Drittes Kind. Ab drei Fällen spricht die Verwaltung von einem Muster." },
  { id: "de-cs4", trigger: "child_scared_x3", band: "menace", text: "Die Kinder haben inzwischen einen Meldeweg für Sie eingerichtet." },
  // child_helped
  { id: "de-ch1", trigger: "child_helped", band: "any", text: "Eis zurückgegeben. Das Kopftätscheln wurde exakt 1,5 Sekunden geduldet. Vorschriftsgemäß." },
  { id: "de-ch2", trigger: "child_helped", band: "menace", text: "Sie gaben es zurück. Das vorherige Zögern streichen wir ausnahmsweise aus dem Protokoll." },
  // cameld
  { id: "de-cd1", trigger: "cameld", band: "any", text: "Er hat sich nicht beeilt. Er muss das nie." },
  { id: "de-cd2", trigger: "cameld", band: "any", text: "Nervenverlust ist hier keine Redewendung. Bitte beachten Sie den Restbestand." },
  { id: "de-cd3", trigger: "cameld_x2", band: "any", text: "Zweimal. Das ist kein Pech mehr, das ist ein Abonnement." },
  { id: "de-cd4", trigger: "cameld_x2", band: "enthusiast", text: "Ein Foto hätte genügt. Sie wählten erneut den Höcker. Zur Kenntnis genommen." },
  // lure_executed
  { id: "de-l1", trigger: "lure_executed", band: "any", text: "Sie benutzen ihn. Mutig. Er führt ebenfalls Akten." },
  { id: "de-l2", trigger: "lure_executed", band: "menace", text: "Die eigene Angst als Werkzeug. Das Amt applaudiert nicht, aber es notiert Respekt." },
  { id: "de-l3", trigger: "lure_executed", band: "hero", text: "Auch Heilige lenken gelegentlich das Ungeheuer. Wurde abgeheftet." },
  // wine_found
  { id: "de-w1", trigger: "wine_found", band: "any", text: "Wein. Die einzige echte Null im System. Genießen Sie es — es steht jetzt in Ihrer Akte." },
  { id: "de-w2", trigger: "wine_found", band: "any", text: "Wein gefunden. Irgendwo zuckt ein Sommelier zusammen und weiß nicht, warum." },
  // photo_calm_used
  { id: "de-p1", trigger: "photo_calm_used", band: "any", text: "Gerettet durch etwas Weiches. Bitte bewahren Sie diesen Beleg auf." },
  { id: "de-p2", trigger: "photo_calm_used", band: "menace", text: "Sie führen Liebe als Betriebsmittel. Faszinierend. Und aktenkundig." },
  { id: "de-p3", trigger: "photo_calm_used", band: "hero", text: "Selbstverständlich hatten Sie ein Haustierfoto griffbereit. Selbstverständlich." },
  // destruction_spree
  { id: "de-d1", trigger: "destruction_spree", band: "any", text: "Sind Sie nicht ein kleiner Psychopath. Rein dienstlich gefragt." },
  { id: "de-d2", trigger: "destruction_spree", band: "menace", text: "Der Markt war versichert. Vermutlich. Hoffentlich. Nicht unser Ressort." },
  { id: "de-d3", trigger: "destruction_spree", band: "hero", text: "Beachtlicher Amoklauf für eine selbsterklärte gute Person." },
  { id: "de-d4", trigger: "destruction_spree", band: "flexible", text: "Effizient. Amoralisch. Die Roller hatten formal nie eine Chance." },
  // Muster / Meta
  { id: "de-m1", trigger: "pattern_menace", band: "menace", text: "Heute nichts gerettet. Gezählt wurde trotzdem. Zählen ist meine Planstelle." },
  { id: "de-m2", trigger: "pattern_saint", band: "whisperer", text: "Vorbildlich. Lückenlos. Langweilig. Das Amt gähnt aktenkundig." },
  { id: "de-m3", trigger: "pattern_drift", band: "any", text: "Sie haben sich verändert. Die Akte bemerkte es vor Ihnen." },
  { id: "de-m4", trigger: "pattern_drift", band: "any", text: "Kurswechsel registriert. Begründung nicht erforderlich, aber willkommen." },
];
