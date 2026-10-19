/** Endless-mode round modifiers (effects live in world.ts / enemies.ts / bosses/base.ts / player.ts). */
export const AFFIXES: Record<string, { name: string; desc: string; color: string }> = {
  volatile: { name: 'VOLATILE', desc: 'ศัตรูระเบิดหลังตาย — หลบวงแดง', color: '#ff2d4a' },
  armored: { name: 'ARMORED', desc: 'ศัตรูรับดาเมจลดลง 20%', color: '#8fa8ff' },
  swift: { name: 'SWIFT', desc: 'ศัตรูทั่วไปเร็วขึ้น 20%', color: '#6dff9e' },
  frenzied: { name: 'FRENZIED', desc: 'บอสพักระหว่างท่าสั้นลง', color: '#ff9a3c' },
  vampiric: { name: 'VAMPIRIC', desc: 'ศัตรูที่ตีโดนจะฟื้น HP', color: '#ff4d8a' },
};
