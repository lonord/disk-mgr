import * as debug from 'debug'
import { readFile, writeFile } from 'fs'
import * as mkdirp from 'mkdirp'
import * as os from 'os'
import { join } from 'path'
import { promisify } from 'util'

const readFileAsync = promisify(readFile)
const writeFileAsync = promisify(writeFile)
const log = debug('disk-mgr:config')

const dir = join(os.homedir(), '.disk-mgr')
const configFile = join(dir, 'config.json')
mkdirp.sync(dir)

const defaultConfig: Configuration = {
	aliasList: []
}

export interface DiskAlias {
	uuid: string
	alias: string
}

export interface Configuration {
	aliasList: DiskAlias[]
}

export async function readConfig() {
	let configuration = defaultConfig
	try {
		const c = await readFileAsync(configFile, 'utf8')
		if (c) {
			configuration = JSON.parse(c)
			log('read config: %j', configuration)
		}
	} catch (e) {
		// ignore
	}
	return configuration
}

export async function writeConfig(config: Configuration) {
	if (!config) {
		return
	}
	await writeFileAsync(configFile, JSON.stringify(config), 'utf8')
	log('write config: %j', configFile)
}
