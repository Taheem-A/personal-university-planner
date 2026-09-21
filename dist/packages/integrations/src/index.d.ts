export type ExternalSourceConfidence = "DIRECT_API" | "CALENDAR_FEED" | "DOCUMENT_EXTRACTION" | "AI_EXTRACTED" | "MANUAL";
export interface ImportedCourse {
    externalId: string;
    code: string;
    name: string;
    sourceConfidence: ExternalSourceConfidence;
}
export interface ImportedAssessment {
    externalId: string;
    courseExternalId: string;
    title: string;
    assessmentType?: string;
    releaseAt?: Date;
    dueAt?: Date;
    instructionsUrl?: string;
    submissionUrl?: string;
    sourceConfidence: ExternalSourceConfidence;
}
export interface IntegrationSyncSummary {
    provider: string;
    added: number;
    updated: number;
    deletedOrMissing: number;
    conflicts: number;
    completedAt: Date;
}
/**
 * Provider-specific systems normalize through this boundary before data reaches
 * canonical domain/application services. Core planner code never depends on a provider.
 */
export interface AcademicSourceAdapter {
    readonly provider: string;
    fetchCourses(): Promise<ImportedCourse[]>;
    fetchAssessments(): Promise<ImportedAssessment[]>;
    sync(): Promise<IntegrationSyncSummary>;
}
