import * as cp from 'child_process'
import * as debug from 'debug'
import { find } from 'lodash'
import { promisify } from 'util'
import { DiskAlias } from './config'

const execAsync = promisify(cp.exec)
const log = debug('disk-mgr:disk')

export interface DiskDevice {
	name: string
	mountpoint: string
	label: string
	uuid: string
	children?: DiskDevice[]
}

export async function listDisk() {
	const cmd = 'lsblk -J -o NAME,MOUNTPOINT,LABEL,UUID'
	const r = await execAsync(cmd)
	log('exec %s -> %j', cmd, r)
	if (r.stderr) {
		throw new Error(r.stderr)
	}
	const infoObj = JSON.parse(r.stdout)
	if (!infoObj || !infoObj.blockdevices) {
		throw new Error('read device info failed')
	}
	return infoObj.blockdevices as DiskDevice[]
}

export async function mountDisk(searchStr: string, mountpoint: string, args: string[], aliasList?: DiskAlias[]) {
	if (!searchStr || !mountpoint) {
		throw new Error('searchStr and mountpoint are required')
	}
	const device = await findDeviceWithAlias(searchStr, aliasList)
	await mount(device, mountpoint, args)
}

export async function umountDisk(searchStr: string, args: string[], aliasList?: DiskAlias[]) {
	if (!searchStr) {
		throw new Error('searchStr are required')
	}
	const device = await findDeviceWithAlias(searchStr, aliasList)
	await umount(device, args)
}

async function findDeviceWithAlias(searchStr: string, aliasList?: DiskAlias[]) {
	if (searchStr.startsWith('/dev/') && searchStr.length > 5) {
		searchStr = searchStr.substring(5)
	}
	const devices = await listDisk()

	if (aliasList) {
		const aliasItem = find(aliasList, { alias: searchStr })
		if (aliasItem) {
			const deviceListByUUID = searchDevicesByUUID(aliasItem.uuid, devices)
			if (deviceListByUUID.length === 1) {
				return deviceListByUUID[0]
			}
		}
	}

	const findResult = findDevice(searchStr, devices)
	if (findResult.done) {
		return findResult.device
	} else if (findResult.hasSameLabel) {
		const devicesWithSameLabel = findResult.devices.map((d) => d.name).join(',')
		throw new Error(`More than one device [${devicesWithSameLabel}] with label '${searchStr}', `
			+ `specify one by device name`)
	} else {
		throw new Error(`Coule not find device '${searchStr}'`)
	}
}

function findDevice(searchStr: string, devices: DiskDevice[]) {
	let hasSameLabel = false
	const deviceListByUUID = searchDevicesByUUID(searchStr, devices)
	if (deviceListByUUID.length === 1) {
		return {
			done: true,
			device: deviceListByUUID[0]
		}
	}
	const deviceListByLabel = searchDevicesByLabel(searchStr, devices)
	if (deviceListByLabel.length === 1) {
		return {
			done: true,
			device: deviceListByLabel[0]
		}
	} else if (deviceListByLabel.length > 1) {
		hasSameLabel = true
	}
	const deviceListByName = searchDevicesByName(searchStr, devices)
	if (deviceListByName.length === 1) {
		return {
			done: true,
			device: deviceListByName[0]
		}
	}
	if (hasSameLabel) {
		return {
			done: false,
			hasSameLabel: true,
			devices: deviceListByLabel
		}
	}
	return {
		done: false,
		hasSameLabel: false
	}
}

function searchDevicesByName(searchStr: string, devices: DiskDevice[]) {
	const result: DiskDevice[] = []
	for (const dev of devices) {
		if (dev.name === searchStr) {
			result.push(dev)
		}
		if (dev.children && dev.children.length > 0) {
			searchDevicesByName(searchStr, dev.children).forEach((d) => result.push(d))
		}
	}
	return result
}

function searchDevicesByLabel(searchStr: string, devices: DiskDevice[]) {
	const result: DiskDevice[] = []
	for (const dev of devices) {
		if (dev.label === searchStr) {
			result.push(dev)
		}
		if (dev.children && dev.children.length > 0) {
			searchDevicesByLabel(searchStr, dev.children).forEach((d) => result.push(d))
		}
	}
	return result
}

function searchDevicesByUUID(searchStr: string, devices: DiskDevice[]) {
	const result: DiskDevice[] = []
	for (const dev of devices) {
		if (dev.uuid === searchStr) {
			result.push(dev)
		}
		if (dev.children && dev.children.length > 0) {
			searchDevicesByUUID(searchStr, dev.children).forEach((d) => result.push(d))
		}
	}
	return result
}

async function mount(device: DiskDevice, mountpoint: string, args: string[]) {
	if (device.mountpoint) {
		throw new Error(`Device '${device.name}' is already mounted to '${device.mountpoint}'`)
	}
	let argsStr = ''
	if (args && args.length > 0) {
		argsStr = ' ' + args.join(' ')
	}
	const cmd = `mount${argsStr} /dev/${device.name} ${mountpoint}`
	const r = await execAsync(cmd)
	log('exec %s -> %j', cmd, r)
	if (r.stderr) {
		throw new Error(r.stderr)
	}
}

async function umount(device: DiskDevice, args: string[]) {
	if (!device.mountpoint) {
		throw new Error(`Device '${device.name}' is not mounted`)
	}
	let argsStr = ''
	if (args && args.length > 0) {
		argsStr = ' ' + args.join(' ')
	}
	const cmd = `umount${argsStr} /dev/${device.name}`
	const r = await execAsync(cmd)
	log('exec %s -> %j', cmd, r)
	if (r.stderr) {
		throw new Error(r.stderr)
	}
}
