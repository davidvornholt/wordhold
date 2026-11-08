import { type SampleCourse, word } from './sample-models';

// A Spanish course that has been running for a month: an old unit that is
// mostly known, a current one with words due, a new one being met, a second
// volume not started yet, and a novel whose words live directly in its book.
export const spanishCourse: SampleCourse = {
  kind: 'language',
  name: 'Spanisch',
  targetLanguage: 'es',
  practisesRelatedWords: true,
  books: [
    {
      name: 'Kursbuch 1',
      units: [
        {
          name: 'Unidad 1: En la ciudad',
          words: [
            word('la calle', 'die Straße', 'known', {
              example: {
                target: 'Vivo en una calle muy tranquila.',
                native: 'Ich wohne in einer sehr ruhigen Straße.',
              },
            }),
            word('el edificio', 'das Gebäude', 'mastered'),
            word('la plaza', 'der Platz', 'known'),
            word('el mercado', 'der Markt', 'known', {
              example: {
                target: 'Los sábados vamos al mercado.',
                native: 'Samstags gehen wir auf den Markt.',
              },
            }),
            word('cerca', 'in der Nähe', 'known', {
              related: { synonyms: [], antonyms: ['lejos'] },
            }),
            word('lejos', 'weit weg', 'overdue', {
              related: { synonyms: [], antonyms: ['cerca'] },
            }),
            word('el ayuntamiento', 'das Rathaus', 'fragile', {
              pitfall: {
                tricky: 'y',
                note: 'Zwischen den beiden Vokalen steht ein y.',
              },
            }),
            word('la parada de autobús', 'die Bushaltestelle', 'due', {
              pitfall: {
                tricky: 'ú',
                note: 'Autobús wird auf der letzten Silbe betont und trägt deshalb einen Akzent.',
              },
            }),
            word('girar a la derecha', 'rechts abbiegen', 'today', {
              example: {
                target: 'En el semáforo, gira a la derecha.',
                native: 'Bieg an der Ampel rechts ab.',
              },
            }),
            word('el semáforo', 'die Ampel', 'relearning', {
              pitfall: {
                tricky: 'á',
                note: 'Betont wird die drittletzte Silbe, deshalb steht dort ein Akzent.',
              },
            }),
          ],
        },
        {
          name: 'Unidad 2: La comida',
          words: [
            word('el desayuno', 'das Frühstück', 'known', {
              example: {
                target: 'El desayuno está en la mesa.',
                native: 'Das Frühstück steht auf dem Tisch.',
              },
            }),
            word('la cereza', 'die Kirsche', 'due', {
              pitfall: {
                tricky: 'z',
                note: 'Vor a schreibt man z, vor e und i dagegen c.',
              },
            }),
            word('el pan', 'das Brot', 'mastered'),
            word('la manzana', 'der Apfel', 'known'),
            word('rico', 'lecker', 'due', {
              related: {
                synonyms: ['sabroso', 'delicioso'],
                antonyms: ['soso'],
              },
            }),
            word('la cuchara', 'der Löffel', 'fragile'),
            word('el tenedor', 'die Gabel', 'learning'),
            word('la cuenta', 'die Rechnung', 'due', {
              example: {
                target: 'La cuenta, por favor.',
                native: 'Die Rechnung, bitte.',
              },
            }),
            word('tener hambre', 'Hunger haben', 'relearning', {
              pitfall: {
                tricky: 'h',
                note: 'Hambre beginnt mit einem stummen h.',
              },
            }),
            word('hervir', 'kochen', 'met'),
            word('la receta', 'das Rezept', 'met'),
          ],
        },
        {
          name: 'Unidad 3: El tiempo libre',
          words: [
            word('el ocio', 'die Freizeit', 'learning', {
              related: {
                synonyms: ['el tiempo libre'],
                antonyms: ['el trabajo'],
              },
            }),
            word(
              'quedar con alguien',
              'sich mit jemandem verabreden',
              'learning',
            ),
            word('aburrido', 'langweilig', 'met', {
              related: { synonyms: [], antonyms: ['divertido'] },
            }),
            word('divertido', 'lustig', 'met', {
              related: { synonyms: ['entretenido'], antonyms: ['aburrido'] },
            }),
            word('el partido', 'das Spiel', 'unmet', {
              example: {
                target: 'El partido empieza a las ocho.',
                native: 'Das Spiel beginnt um acht.',
              },
            }),
            word('la entrada', 'die Eintrittskarte', 'unmet'),
            word('nadar', 'schwimmen', 'unmet'),
            word('pasear', 'spazieren gehen', 'unmet'),
          ],
        },
      ],
      words: [],
    },
    {
      name: 'Kursbuch 2',
      units: [
        {
          name: 'Unidad 1: De viaje',
          words: [
            word('el equipaje', 'das Gepäck', 'unmet'),
            word('la maleta', 'der Koffer', 'unmet'),
            word('el billete', 'die Fahrkarte', 'unmet'),
            word('el andén', 'der Bahnsteig', 'unmet'),
            word('alojarse', 'übernachten', 'unmet'),
          ],
        },
        {
          name: 'Unidad 2: En el trabajo',
          words: [
            word('la reunión', 'die Besprechung', 'unmet'),
            word('el sueldo', 'das Gehalt', 'unmet'),
            word('la empresa', 'die Firma', 'unmet'),
          ],
        },
      ],
      words: [],
    },
    {
      name: 'Ein Sommer am Meer',
      units: [],
      words: [
        word('la brisa', 'die Brise', 'known'),
        word('el muelle', 'der Kai', 'due'),
        word('asomarse', 'sich hinauslehnen', 'fragile'),
        word('la gaviota', 'die Möwe', 'today'),
        word('la bahía', 'die Bucht', 'unmet'),
      ],
    },
  ],
};

// Synonyms and antonyms are switched off here, so the words that have them
// show how a course without that practice looks.
export const englishCourse: SampleCourse = {
  kind: 'language',
  name: 'Englisch',
  targetLanguage: 'en',
  practisesRelatedWords: false,
  books: [
    {
      name: 'Kursbuch 3',
      units: [
        {
          name: 'Unit 1: At school',
          words: [
            word('the timetable', 'der Stundenplan', 'known'),
            word('the break', 'die Pause', 'due'),
            word('to borrow', 'ausleihen', 'fragile', {
              related: { synonyms: [], antonyms: ['to lend'] },
            }),
            word('the homework', 'die Hausaufgaben', 'mastered'),
            word('the head teacher', 'der Schulleiter', 'known'),
            word('to be good at', 'gut sein in', 'today', {
              example: {
                target: 'She is good at maths.',
                native: 'Sie ist gut in Mathe.',
              },
            }),
          ],
        },
        {
          name: 'Unit 2: The weather',
          words: [
            word('the forecast', 'die Wettervorhersage', 'learning'),
            word('foggy', 'neblig', 'due'),
            word('the thunderstorm', 'das Gewitter', 'met'),
            word('to shiver', 'zittern', 'unmet'),
            word('chilly', 'kühl', 'unmet'),
            word('the rainbow', 'der Regenbogen', 'unmet'),
          ],
        },
      ],
      words: [],
    },
  ],
};

// Nothing met yet, so the course page leads into the learning pass.
export const frenchCourse: SampleCourse = {
  kind: 'language',
  name: 'Französisch',
  targetLanguage: 'fr',
  practisesRelatedWords: true,
  books: [
    {
      name: 'Kursbuch 1',
      units: [
        {
          name: 'Unité 1: Bonjour',
          words: [
            word('bonjour', 'guten Tag', 'unmet'),
            word('merci', 'danke', 'unmet'),
            word('au revoir', 'auf Wiedersehen', 'unmet'),
            word("s'il vous plaît", 'bitte', 'unmet'),
            word('le voisin', 'der Nachbar', 'unmet'),
            word('la boulangerie', 'die Bäckerei', 'unmet', {
              example: {
                target: 'La boulangerie ouvre à sept heures.',
                native: 'Die Bäckerei öffnet um sieben Uhr.',
              },
            }),
          ],
        },
      ],
      words: [],
    },
  ],
};

// The course of the other active member, so their page has progress to show.
export const familyEnglishCourse: SampleCourse = {
  kind: 'language',
  name: 'Englisch',
  targetLanguage: 'en',
  practisesRelatedWords: true,
  books: [
    {
      name: 'Kursbuch 1',
      units: [
        {
          name: 'Unit 1: My family',
          words: [
            word('the brother', 'der Bruder', 'known'),
            word('the aunt', 'die Tante', 'due'),
            word('the grandmother', 'die Großmutter', 'learning'),
            word('the cousin', 'der Cousin', 'fragile'),
            word('the twins', 'die Zwillinge', 'met'),
            word('the uncle', 'der Onkel', 'unmet'),
          ],
        },
        {
          name: 'Unit 2: My home',
          words: [
            word('the kitchen', 'die Küche', 'known'),
            word('the stairs', 'die Treppe', 'due'),
            word('the garden', 'der Garten', 'unmet'),
          ],
        },
      ],
      words: [],
    },
  ],
};
