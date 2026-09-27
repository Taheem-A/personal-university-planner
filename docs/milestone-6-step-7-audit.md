# Milestone 6 Step 7 cross-screen audit

This is a code and synthetic browser audit of the production routes. The final authenticated live database journey remains Step 8 evidence.

| Fact or action                                            | Read location                                    | Correction or creation path                                                    |
| --------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Term name, dates, status                                  | Courses, onboarding                              | Courses → Academic terms → Edit term; archive requires confirmation            |
| Course code, name, section, instructor, planning defaults | Courses, Course Detail, onboarding               | Courses → Edit course; archived parents cannot be edited                       |
| Recurring class time, recurrence, timezone, attendance    | Course Detail, Availability, Week                | Course Detail → Edit meeting; Availability links to Courses                    |
| Assessment true deadline, weight, notes, links            | Upcoming, Assessment Detail, Course Detail, Week | Assessment Detail or Course Detail → Edit assessment                           |
| Task estimate, due date, parent/subtask and planning mode | Today, Week, Upcoming, Course Detail             | Edit task facts or Course Detail → Edit task                                   |
| Fixed manual event time and constraint                    | Calendar & Availability                          | Edit event in its week; create through Manual Add                              |
| Availability and protected time                           | Calendar & Availability, onboarding              | Edit availability or protected-time rule; deactivate with confirmation         |
| Planning policy and timezone                              | Settings, onboarding                             | Settings → planning preferences or timezone                                    |
| Raw ambiguous capture and proposal                        | Inbox                                            | Review/correct proposal, process atomically, or dismiss; original text remains |

Global **Manual Add** opens the existing assessment, task, course, meeting, event, availability and protected-time editors. **Quick Capture** remains the raw Inbox path for uncertain information. Term creation remains in the Courses setup context. The chooser does not write or plan; each editor still uses its existing same-origin transport, M2 service and M4 trigger. Successful saves refresh server reads; navigation to another screen reads canonical state afresh. A stale save keeps its old version and offers an explicit reload of the latest record; it never resubmits automatically. Archive and deactivation controls use consequence-specific labels and confirmation.

The browser matrix covers 1440, 1024, 768, 640 and 390 CSS pixels across light/dark screens, plus mobile and 200% equivalent interaction, reduced motion, keyboard focus, target size, Back/Forward and editor semantics. The Step 7 tests add the Manual Add route map and a synthetic Add → Course creation → Course Detail correction → archive-confirmation navigation path. These rendered tests do not prove a live persisted browser mutation; Step 8 must perform that journey with a fresh authenticated account.

Release-boundary review found no new execution outcomes, session dragging, Scenario Apply, provider OAuth/sync, LLM Planner commands, forecasting, Quercus integration or recurring coursework automation in this slice.
