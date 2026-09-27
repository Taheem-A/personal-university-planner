import assert from "node:assert/strict";
import test from "node:test";
import { renderWorkloadEditor } from "../support/secondary-ui-render.mjs";

test("assessment and task editors distinguish true deadlines, unknowns and scheduling facts", () => {
  const assessment = renderWorkloadEditor("assessment");
  assert.match(assessment, /True due date and time/);
  assert.match(assessment, /Leave blank if the deadline is unknown/);
  assert.match(assessment, /Add a work task after saving/);
  assert.match(assessment, /Grade weight/);
  assert.doesNotMatch(assessment, /Complete task|Mark submitted/);
  const task = renderWorkloadEditor("task");
  assert.match(task, /Estimated work \(minutes\)/);
  assert.match(task, /True task deadline/);
  assert.match(task, /Available from/);
  assert.match(task, /Typical session length/);
  assert.match(task, /Parent task/);
  assert.match(task, /Planning mode/);
  assert.match(task, /Can split across sessions/);
  assert.match(task, /Completion and partial work updates arrive in Milestone 7/);
});

test("editing an independent task keeps its null assessment and course associations", () => {
  const task = {
    id: "independent",
    version: 2,
    title: "Read",
    description: null,
    courseId: null,
    assessmentId: null,
    parentTaskId: null,
    status: "READY",
    dueAt: null,
    preferredCompletionAt: null,
    availableFrom: null,
    originalEstimatedMinutes: null,
    currentEstimatedMinutes: null,
    remainingMinutes: null,
    energyRequirement: null,
    locationRequirements: [],
    minimumSessionMinutes: null,
    preferredSessionMinutes: null,
    maximumSessionMinutes: null,
    splittable: true,
    interruptible: true,
    planningMode: "AUTO",
    priorityOverride: null,
  };
  const html = renderWorkloadEditor("task", {
    task,
    selectedAssessmentId: "other-assessment",
    selectedCourseId: "synthetic-course",
    selectedParentId: "other-parent",
    assessments: [{ id: "other-assessment", courseId: "synthetic-course", title: "Other" }],
  });
  assert.match(html, /<option value="" selected="">None<\/option>/);
  assert.match(html, /<option value="" selected="">Personal \/ no course<\/option>/);
  assert.match(html, /<option value="" selected="">None · top-level task<\/option>/);
  assert.match(html, /Add a subtask/);
  assert.match(html, /parent=independent/);
  assert.doesNotMatch(renderWorkloadEditor("assessment"), /Add a subtask/);
});
