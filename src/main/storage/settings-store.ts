import type { AppSettings } from '@shared/ai'
import {
  CURRICULUM_IDS,
  DEFAULT_TEACHER_PROFILE,
  DEFAULT_TEACHING_DEFAULTS,
  GRADE_LEVELS,
  PROFILE_NAME_MAX,
  TEACHER_TITLE_IDS,
  TEACHING_LANGUAGES,
  type CurriculumFramework,
  type TeacherProfile,
  type TeacherTitle,
  type TeachingDefaults,
} from '@shared/teaching'
import { readJsonFile, writeJsonFileAtomic } from './json-file'

const CURRICULA: readonly CurriculumFramework[] = CURRICULUM_IDS

/**
 * Validate teaching defaults. Throws with a readable message on bad input
 * from the renderer; `lenient` mode (reading from disk) falls back per field.
 */
export function parseTeachingDefaults(value: unknown, lenient = false): TeachingDefaults {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const d = DEFAULT_TEACHING_DEFAULTS
  const fail = (msg: string) => {
    if (!lenient) throw new Error(msg)
  }
  const text = (key: keyof TeachingDefaults, label: string, max: number): string => {
    const raw = v[key]
    if (typeof raw === 'string' && raw.trim() && raw.length <= max) return raw.trim()
    fail(`${label} is required (up to ${max} characters).`)
    return d[key] as string
  }

  const country = text('country', 'Country', 80)
  const subject = text('subject', 'Default subject', 200)

  let gradeLevel = d.gradeLevel
  if (typeof v.gradeLevel === 'string' && GRADE_LEVELS.includes(v.gradeLevel))
    gradeLevel = v.gradeLevel
  else fail('Choose a valid default grade level.')

  let curriculum = d.curriculum
  if (CURRICULA.includes(v.curriculum as CurriculumFramework))
    curriculum = v.curriculum as CurriculumFramework
  else fail('Choose a valid curriculum.')

  let durationMinutes = d.durationMinutes
  const dm = v.durationMinutes
  if (typeof dm === 'number' && Number.isInteger(dm) && dm >= 10 && dm <= 300) durationMinutes = dm
  else fail('Default duration must be a whole number from 10 to 300 minutes.')

  let language = d.language
  if (TEACHING_LANGUAGES.includes(v.language as TeachingDefaults['language'])) {
    language = v.language as TeachingDefaults['language']
  } else fail('Choose a valid language.')

  return { country, curriculum, gradeLevel, subject, durationMinutes, language }
}

/**
 * Validate the teacher profile. Throws on bad input from the renderer;
 * `lenient` mode (reading from disk) falls back per field.
 */
export function parseTeacherProfile(value: unknown, lenient = false): TeacherProfile {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const fail = (msg: string) => {
    if (!lenient) throw new Error(msg)
  }

  let name = DEFAULT_TEACHER_PROFILE.name
  const raw = v.name
  const hasControlChars = (t: string) =>
    [...t].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  if (typeof raw === 'string' && raw.length <= PROFILE_NAME_MAX && !hasControlChars(raw)) {
    name = raw.replace(/\s+/g, ' ').trim()
  } else fail(`Name must be text of up to ${PROFILE_NAME_MAX} characters.`)

  let title: TeacherTitle = DEFAULT_TEACHER_PROFILE.title
  if (TEACHER_TITLE_IDS.includes(v.title as TeacherTitle)) title = v.title as TeacherTitle
  else fail('Choose Ma’am, Sir or Name only.')

  return { name, title }
}

/** App settings stored as a single JSON file in the user data folder. */
export class SettingsStore {
  constructor(private readonly file: string) {}

  async get(): Promise<AppSettings> {
    const data = (await readJsonFile(this.file)) as Partial<AppSettings> | null
    return {
      claudeCodeWorkspace:
        typeof data?.claudeCodeWorkspace === 'string' ? data.claudeCodeWorkspace : null,
      teaching: data?.teaching
        ? parseTeachingDefaults(data.teaching, true)
        : { ...DEFAULT_TEACHING_DEFAULTS },
      profile: data?.profile
        ? parseTeacherProfile(data.profile, true)
        : { ...DEFAULT_TEACHER_PROFILE },
    }
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = { ...(await this.get()), ...patch }
    await writeJsonFileAtomic(this.file, next)
    return next
  }
}
