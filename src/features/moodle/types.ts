export type MoodlePlatform = "ecampus" | "campusvirtual" | "virtualutp";

export const MOODLE_PLATFORMS: Record<MoodlePlatform, { label: string; baseUrl: string }> = {
  ecampus: { label: "eCampus", baseUrl: "https://ecampus.utp.ac.pa/moodle" },
  campusvirtual: { label: "Campus Virtual", baseUrl: "https://campusvirtual.utp.ac.pa/moodle" },
  virtualutp: { label: "Virtual UTP", baseUrl: "https://virtual.utp.ac.pa/moodle" },
};

export interface MoodleCredentials {
  id: string;
  userId: string;
  platform: MoodlePlatform;
  username: string;
  encryptedPassword: string;
  iv: string;
  tag: string;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface MoodleCourse {
  id: number;
  shortname: string;
  fullname: string;
  categoryid: number;
}

export interface MoodleEvent {
  id: number;
  name: string;
  description: string;
  modulename: string;
  courseid: number | null;
  timestart: number;
  timedue: number | null;
  url: string;
}

export interface MoodleSyncResult {
  platform: MoodlePlatform;
  courses: number;
  assignments: number;
  errors: string[];
}
