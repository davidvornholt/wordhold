import { extractionWorkloads } from './extraction-workloads';
import { generationWorkloads } from './generation-workloads';
import { gradingWorkloads } from './grading-workloads';
import type { Workload } from './workload';

export const workloads = async (): Promise<ReadonlyArray<Workload>> => [
  ...gradingWorkloads,
  ...generationWorkloads,
  ...(await extractionWorkloads()),
];
