import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_TEACHER_PROFILE,
  DEFAULT_TEACHING_DEFAULTS,
  addressTeacher, isProfileEmpty } from '@shared/teaching'
import { SettingsStore, parseTeacherProfile, parseTeachingDefaults } from './settings-store'

describe('teaching defaults validation', () => {
  it('accepts every curriculum, including ILAW', () => {
    const parsed = parseTeachingDefaults({ ...DEFAULT_TEACHING_DEFAULTS, curriculum: 'ilaw' })
    expect(parsed.curriculum).toBe('ilaw')
  })
})

describe('addressing the teacher', () => {
  it('uses Ma’am / Sir with the name', () => {
    expect(addressTeacher({ name: 'Liza', title: 'maam' })).toBe('Ma’am Liza')
    expect(addressTeacher({ name: 'Juan', title: 'sir' })).toBe('Sir Juan')
    expect(addressTeacher({ name: '  Dela   Cruz ', title: 'sir' })).toBe('Sir Dela Cruz')
  })

  it('works with only a title, only a name, or nothing', () => {
    expect(addressTeacher({ name: '', title: 'maam' })).toBe('Ma’am')
    expect(addressTeacher({ name: '   ', title: 'sir' })).toBe('Sir')
    expect(addressTeacher({ name: 'Liza', title: 'none' })).toBe('Liza')
    expect(addressTeacher(DEFAULT_TEACHER_PROFILE)).toBe('Teacher')
  })

  it('does not double a title the teacher typed', () => {
    expect(addressTeacher({ name: "Ma'am Liza", title: 'maam' })).toBe('Ma’am Liza')
    expect(addressTeacher({ name: 'sir Juan', title: 'sir' })).toBe('Sir Juan')
    expect(addressTeacher({ name: "Ma'am Liza", title: 'none' })).toBe("Ma'am Liza")
  })

  it('knows when nothing is set', () => {
    expect(isProfileEmpty(DEFAULT_TEACHER_PROFILE)).toBe(true)
    expect(isProfileEmpty({ name: '', title: 'sir' })).toBe(false)
    expect(isProfileEmpty({ name: 'Liza', title: 'none' })).toBe(false)
  })
})

describe('teacher profile validation', () => {
  it('accepts a valid profile and tidies the name', () => {
    expect(parseTeacherProfile({ name: '  Liza  ', title: 'maam' })).toEqual({
      name: 'Liza',
      title: 'maam',
    })
  })

  it('rejects bad input from the renderer', () => {
    expect(() => parseTeacherProfile({ name: 'Liza', title: 'female' })).toThrow(/Ma’am, Sir/)
    expect(() => parseTeacherProfile({ name: 'x'.repeat(61), title: 'sir' })).toThrow(/60/)
    expect(() => parseTeacherProfile({ name: 'Li\u0000za', title: 'sir' })).toThrow(/Name/)
    expect(() => parseTeacherProfile({ name: 5, title: 'sir' })).toThrow(/Name/)
  })

  it('falls back per field when reading from disk', () => {
    expect(parseTeacherProfile({ name: 'Liza', title: 'female' }, true)).toEqual({
      name: 'Liza',
      title: 'none',
    })
    expect(parseTeacherProfile(null, true)).toEqual(DEFAULT_TEACHER_PROFILE)
  })
})

describe('settings store', () => {
  let dir: string | null = null
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
    dir = null
  })

  it('round-trips the profile and loads older settings without one', async () => {
    dir = await mkdtemp(join(tmpdir(), 'tm-settings-'))
    const file = join(dir, 'settings.json')
    // A settings file written before profiles existed.
    await writeFile(file, JSON.stringify({ claudeCodeWorkspace: null }))
    const store = new SettingsStore(file)
    expect((await store.get()).profile).toEqual(DEFAULT_TEACHER_PROFILE)

    await store.update({ profile: { name: 'Juan', title: 'sir' } })
    expect((await store.get()).profile).toEqual({ name: 'Juan', title: 'sir' })
    const onDisk = JSON.parse(await readFile(file, 'utf8'))
    expect(onDisk.profile).toEqual({ name: 'Juan', title: 'sir' })
    expect((await store.get()).teaching.country).toBe('Philippines')
  })
})
