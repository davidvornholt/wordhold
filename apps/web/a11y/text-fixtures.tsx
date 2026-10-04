import { useId, useState } from 'react';
import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';
import type { CourseEntryActions } from '../src/features/courses/ui/entry-actions';
import { SubjectOverview } from '../src/features/courses/ui/subject-overview';
import { SubjectSettings } from '../src/features/courses/ui/subject-settings';
import {
  EditTextForm,
  NewTextForm,
  type TextDraft,
} from '../src/features/courses/ui/text-entry-forms';
import type { LearnItem } from '../src/features/learning/schemas/learning-models';
import { LearnPass } from '../src/features/learning/ui/learn-pass';
import type { SubmitResult } from '../src/features/practice/schemas/practice-models';
import type { SubmitPayloadData } from '../src/features/practice/schemas/submission-schema';
import { CardPractice } from '../src/features/practice/ui/card-practice';
import { FeedbackPanel } from '../src/features/practice/ui/feedback-panel';
import { directionLabel } from '../src/shared/directions';
import { withoutExamples } from '../src/shared/examples/example-model';
import {
  deriveRating,
  gradeRecitation,
  isCorrect,
} from '../src/shared/grading/rating';
import { Button } from '../src/shared/ui/button';
import { CardRail } from '../src/shared/ui/card-rail';
import { FocusLayout } from '../src/shared/ui/focus-layout';
import { PageLayout } from '../src/shared/ui/page-layout';
import { WordCard } from '../src/shared/ui/word-card';
import { fixtureTextLookup } from './bible-fixture-data';
import { FixtureBibleLibrary } from './bible-fixtures';
import { textsSubject } from './course-fixture-data';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';
import {
  collectionEntries,
  collectionName,
  nearlyRecited,
  textEntry,
  verse,
  verseTitle,
} from './text-fixture-data';

const backControl = fixtureBackControl(collectionName, 'texts-course');
const title = `${collectionName} · Üben`;

const learnItem: LearnItem = {
  cardId: '00000000-0000-0000-0000-000000000071',
  direction: 'to_native',
  entryId: '00000000-0000-0000-0000-000000000072',
  targetText: verseTitle,
  nativeText: verse,
  hasAudio: false,
  example: null,
  textbookAnswers: [],
  keyPoints: null,
};

const practiceItem = {
  cardId: learnItem.cardId,
  revision: 0,
  direction: 'to_native' as const,
  entryId: learnItem.entryId,
  targetText: verseTitle,
  nativeText: verse,
  hasAudio: false,
  entryKnown: false,
  example: null,
  prompt: verseTitle,
};

// A known text comes back tomorrow morning; a missed one is due again now.
const nextReviewHour = 8;
const tomorrowMorning = new Date();
tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
tomorrowMorning.setHours(nextReviewHour, 0, 0, 0);

// Graded the way the server grades a recited text: word for word, never by
// the judge, and stored at once.
const recitedResult = (
  answer: string,
  dictated: boolean,
  revision: number,
): SubmitResult => {
  const outcome = gradeRecitation(verse, answer, { dictated });
  const correct = isCorrect(outcome);
  return {
    graded: true,
    correct,
    stored: true,
    revision,
    rating: deriveRating(outcome, null),
    expectedAnswer: verse,
    explanation: null,
    acceptedAsAlternative: false,
    keyPoints: null,
    schedule: correct
      ? { advanced: true, state: 'review', dueAt: tomorrowMorning }
      : { advanced: true, state: 'relearning', dueAt: new Date() },
    entryKnown: false,
  };
};

const submitRecitation = ({
  data,
}: {
  readonly data: SubmitPayloadData;
}): Promise<SubmitResult> =>
  Promise.resolve(
    'skipped' in data
      ? recitedResult('', false, data.revision + 1)
      : recitedResult(data.answer, data.dictated, data.revision + 1),
  );

export const TextsLearnFixture = () => (
  <FocusLayout exit={backControl} title={`${collectionName} · Kennenlernen`}>
    <LearnPass
      completionControls={fixtureControl(
        'Jetzt üben · Titel → Text',
        'texts-practice',
        'primary',
      )}
      directionLabel={directionLabel('to_native', textsSubject)}
      items={[learnItem]}
      onIntroduce={() => Promise.resolve()}
      subject={textsSubject}
    />
  </FocusLayout>
);

export const TextsPracticeFixture = () => (
  <FocusLayout exit={backControl} title={title}>
    <CardRail
      activeIndex={0}
      activeOutcome={null}
      description="0 von 1 Karte bearbeitet"
      label="Abschnitt 1"
      ticks={[null]}
    />
    <CardPractice
      deck={0}
      item={practiceItem}
      mode="scheduled"
      onJudged={() => undefined}
      onNext={() => navigateToFixture('practice-empty')}
      prepareExamples={withoutExamples}
      repeated={false}
      subject={textsSubject}
      submit={submitRecitation}
    />
  </FocusLayout>
);

export const TextsFeedbackFixture = () => {
  const promptId = useId();
  const feedbackId = useId();
  return (
    <FocusLayout exit={backControl} title={title}>
      <WordCard
        deck={0}
        eyebrow="Schreib den Text auswendig"
        tone="positive"
        word={verseTitle}
        wordId={promptId}
        wordLang="de"
      >
        <FeedbackPanel
          answerLanguage="de"
          busy={false}
          dictated={false}
          example={null}
          id={feedbackId}
          kind="texts"
          playSentence={null}
          playWord={null}
          repeated={false}
          result={recitedResult(nearlyRecited, false, 1)}
          skipped={false}
          submittedAnswer={nearlyRecited}
          targetLanguage="de"
        />
      </WordCard>
    </FocusLayout>
  );
};

// Typed and corrected texts change the list in memory, the way the page's
// refreshed loader would show them.
const useFixtureTexts = (initial: ReadonlyArray<VocabularyEntry>) => {
  const [entries, setEntries] = useState(initial);
  const createEntry = ({ title: typedTitle, text }: TextDraft) => {
    setEntries((current) => [
      ...current,
      textEntry(current.length + 1, {
        title: typedTitle,
        text,
        introduced: false,
        failures: 0,
      }),
    ]);
    return Promise.resolve();
  };
  const updateEntry = (
    entryId: string,
    { title: typedTitle, text }: TextDraft,
  ) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? { ...entry, targetText: typedTitle, nativeText: text }
          : entry,
      ),
    );
    return Promise.resolve();
  };
  const removeEntry = (entryId: string) =>
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
  return { entries, createEntry, updateEntry, removeEntry };
};

const textsStudyAction = (
  _entryIds: ReadonlyArray<string>,
  intent: 'learn' | 'practice',
) => (
  <Button
    onClick={() =>
      navigateToFixture(intent === 'learn' ? 'texts-learn' : 'texts-practice')
    }
  >
    Auswahl {intent === 'learn' ? 'kennenlernen' : 'üben'}
  </Button>
);

// A collection's page is its list of texts, typed under a title each.
export const TextsCourseFixture = ({
  empty = false,
}: {
  readonly empty?: boolean;
}) => {
  const { entries, createEntry, updateEntry, removeEntry } = useFixtureTexts(
    empty ? [] : collectionEntries,
  );
  const entryActions: CourseEntryActions = {
    renderDetail: () => null,
    renderEditor: (entry, control) => (
      <EditTextForm
        control={control}
        entries={entries}
        entry={entry}
        updateEntry={(draft) => updateEntry(entry.id, draft)}
      />
    ),
    remove: (entry) => {
      globalThis.setTimeout(() => removeEntry(entry.id));
      return Promise.resolve();
    },
  };
  return (
    <PageLayout
      backControl={fixtureBackControl('Übersicht', 'dashboard-subjects')}
      title={collectionName}
    >
      <SubjectOverview
        enabledDirections={['to_native']}
        entries={entries}
        entryActions={entryActions}
        entryForm={
          <NewTextForm
            createEntry={createEntry}
            entries={entries}
            lookup={fixtureTextLookup}
          />
        }
        initialFilter="all"
        primaryAction={
          empty
            ? null
            : fixtureControl('1 Karte üben', 'texts-practice', 'primary')
        }
        renderStudyAction={textsStudyAction}
        settingsAction={fixtureControl(
          'Einstellungen',
          'texts-settings',
          'quiet',
        )}
        subject={textsSubject}
      />
    </PageLayout>
  );
};

const collectionId = '00000000-0000-0000-0000-000000000008';

export const TextsSettingsFixture = () => {
  const [name, setName] = useState(collectionName);
  return (
    <PageLayout
      backControl={fixtureBackControl(name, 'texts-course')}
      title={`${name}: Einstellungen`}
    >
      <div className="flex flex-col gap-10">
        <SubjectSettings
          courseId={collectionId}
          courses={[{ id: collectionId, name: collectionName }]}
          kind="texts"
          name={name}
          rename={(next) => {
            setName(next);
            return Promise.resolve();
          }}
        />
        <FixtureBibleLibrary />
      </div>
    </PageLayout>
  );
};
