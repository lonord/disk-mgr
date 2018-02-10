import { find, findIndex } from 'lodash'
import { Configuration, DiskAlias, readConfig, writeConfig } from './config'
import { DiskDevice, listDisk, mountDisk, umountDisk } from './disk'

export {
	DiskDevice,
	Configuration,
	DiskAlias
}

export default {
	listDisk,
	mountDisk: async (searchStr: string, mountpoint: string, args?: string[]) => {
		args = args || []
		const c = await readConfig()
		await mountDisk(searchStr, mountpoint, args, c.aliasList)
	},
	umountDisk: async (searchStr: string, args?: string[]) => {
		args = args || []
		const c = await readConfig()
		await umountDisk(searchStr, args, c.aliasList)
	},
	listAlias: async () => {
		const c = await readConfig()
		return c.aliasList
	},
	addAlias: async (alias: DiskAlias) => {
		const c = await readConfig()
		const a = find(c.aliasList, { alias: alias.alias })
		if (a) {
			throw new Error(`Alias is already exist [${a.alias} -> ${a.uuid}]`)
		}
		c.aliasList.push(alias)
		await writeConfig(c)
	},
	removeAlias: async (aliasName: string) => {
		const c = await readConfig()
		const i = findIndex(c.aliasList, { alias: aliasName })
		if (i === -1) {
			throw new Error(`Could not find alias '${aliasName}'`)
		}
		c.aliasList.splice(i, 1)
		await writeConfig(c)
	}
}
