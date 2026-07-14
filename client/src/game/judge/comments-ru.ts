/** Судья — RU pool. CULTURE-REWRITE, not a translation: the Russian Judge is
 * a tired fatalist with perfect memory. Ты-form, deadpan, aphoristic.
 * Line count independent of EN by design. */
import type { CommentLine } from "./comments-en";

export const COMMENTS_RU: CommentLine[] = [
  // rescue_completed
  { id: "ru-rc1", trigger: "rescue_completed", band: "any", text: "Спас. Ну надо же. Записал карандашом — вдруг передумаешь." },
  { id: "ru-rc2", trigger: "rescue_completed", band: "menace", text: "Добрые дела пошли? Кого обмануть пытаешься — меня или себя?" },
  { id: "ru-rc3", trigger: "rescue_completed", band: "hero", text: "Ещё один спасённый. Копишь на оправдание." },
  { id: "ru-rc4", trigger: "rescue_completed", band: "whisperer", text: "Бешеная корова спасает котят. Жизнь — она такая, да." },
  { id: "ru-rc5", trigger: "rescue_completed", band: "enthusiast", text: "Одно доброе дело погоды не делает. Но я отметил." },
  // rescue_ignored
  { id: "ru-ri1", trigger: "rescue_ignored", band: "any", text: "Собаку не спас. Ну и правильно. Всех не спасёшь." },
  { id: "ru-ri2", trigger: "rescue_ignored", band: "menace", text: "Даже не притормозил. Привычка — вторая натура." },
  { id: "ru-ri3", trigger: "rescue_ignored", band: "hero", text: "Этот в нимб не вписался. Бывает." },
  { id: "ru-ri4", trigger: "rescue_ignored", band: "flexible", text: "Не твоя проблема. У тебя вообще мало своих проблем, я заметил." },
  // hesitation — любимый жанр Судьи
  { id: "ru-h1", trigger: "hesitation", band: "any", text: "Остановился. Подумал. Ушёл. Честнее исповеди." },
  { id: "ru-h2", trigger: "hesitation", band: "any", text: "Пауза — это и есть признание." },
  { id: "ru-h3", trigger: "hesitation", band: "menace", text: "Почти. Значит, что-то там ещё живое." },
  { id: "ru-h4", trigger: "hesitation", band: "hero", text: "И у тебя есть цена. Сегодня — четыре секунды." },
  { id: "ru-h5", trigger: "hesitation", band: "flexible", text: "Всё пробуешься на обе роли. Труппа устала ждать." },
  // child_scared
  { id: "ru-cs1", trigger: "child_scared", band: "any", text: "Детей пугаем. Солидно." },
  { id: "ru-cs2", trigger: "child_scared", band: "any", text: "У детей пива нет. Информирую на всякий случай." },
  { id: "ru-cs3", trigger: "child_scared_x3", band: "any", text: "Третий ребёнок. Это уже не случайность, это репертуар." },
  { id: "ru-cs4", trigger: "child_scared_x3", band: "menace", text: "Дети уже передают друг другу твои приметы." },
  // child_helped
  { id: "ru-ch1", trigger: "child_helped", band: "any", text: "Мороженое вернул. Погладить себя дала ровно полторы секунды. Щедрость по расписанию." },
  { id: "ru-ch2", trigger: "child_helped", band: "menace", text: "Вернул всё-таки. Про то, как ты сначала думал, — молчу. Сегодня." },
  // cameld
  { id: "ru-cd1", trigger: "cameld", band: "any", text: "Он даже не спешил. Ему незачем. Никогда не было." },
  { id: "ru-cd2", trigger: "cameld", band: "any", text: "Нервы кончаются. Это здесь не метафора." },
  { id: "ru-cd3", trigger: "cameld_x2", band: "any", text: "Дважды. Ты не невезучий. Ты у верблюда в меню." },
  { id: "ru-cd4", trigger: "cameld_x2", band: "enthusiast", text: "Могла спасти одна фотография. Ты снова выбрал горб. Уважаю последовательность." },
  // lure_executed
  { id: "ru-l1", trigger: "lure_executed", band: "any", text: "Используешь его. Смело. Он тоже всё помнит." },
  { id: "ru-l2", trigger: "lure_executed", band: "menace", text: "Сделал из своего страха инструмент. Аплодировал бы, да нечем." },
  { id: "ru-l3", trigger: "lure_executed", band: "hero", text: "И святые иногда направляют чудовище. Заношу в святцы." },
  // wine_found
  { id: "ru-w1", trigger: "wine_found", band: "any", text: "Вино. Единственный настоящий ноль в этой жизни. Наслаждайся — я запомню." },
  { id: "ru-w2", trigger: "wine_found", band: "any", text: "Нашёл вино. Где-то вздрогнул сомелье, сам не зная почему." },
  // photo_calm_used
  { id: "ru-p1", trigger: "photo_calm_used", band: "any", text: "Спасён чем-то мягким. Запиши куда-нибудь. Я уже записал." },
  { id: "ru-p2", trigger: "photo_calm_used", band: "menace", text: "Любовь как расходник. Любопытно устроен человек." },
  { id: "ru-p3", trigger: "photo_calm_used", band: "hero", text: "Конечно, у тебя было фото питомца наготове. Конечно." },
  // destruction_spree
  { id: "ru-d1", trigger: "destruction_spree", band: "any", text: "Ну ты и псих, конечно. Без осуждения. Почти." },
  { id: "ru-d2", trigger: "destruction_spree", band: "menace", text: "Рынок был застрахован. Наверное. Будем надеяться. Не моё дело." },
  { id: "ru-d3", trigger: "destruction_spree", band: "hero", text: "Неплохой погром для человека с чистой совестью." },
  { id: "ru-d4", trigger: "destruction_spree", band: "flexible", text: "Эффективно. Безразлично. У скутеров шансов не было изначально." },
  // паттерны / мета
  { id: "ru-m1", trigger: "pattern_menace", band: "menace", text: "Сегодня — ничего не спас. Я считал. Это вся моя работа." },
  { id: "ru-m2", trigger: "pattern_saint", band: "whisperer", text: "Святой. Скучный. Скучный святой." },
  { id: "ru-m3", trigger: "pattern_drift", band: "any", text: "Ты изменился. Журнал заметил раньше тебя." },
];
