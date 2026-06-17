import * as fs from 'fs/promises'
import * as path from 'path'

export interface AppConfig {
  folders: string[]
  thumbnailSize: number
  scanOnStartup: boolean
}

const DEFAULT_CONFIG: AppConfig = {
  folders: [],
  thumbnailSize: 300,
  scanOnStartup: true
}

export class ConfigManager {
  private readonly configPath: string

  constructor(userDataPath: string) {
    this.configPath = path.join(userDataPath, 'config.json')
  }

  /**
   * Loads the config from disk, or returns default config if the file doesn't exist.
   */
  async load(): Promise<AppConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8')
      const parsed = JSON.parse(data) as Partial<AppConfig>
      return { ...DEFAULT_CONFIG, ...parsed }
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }

  /**
   * Persists the config to disk.
   */
  async save(config: AppConfig): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true })
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  /**
   * Returns true if a config file already exists on disk.
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.configPath)
      return true
    } catch {
      return false
    }
  }
}
