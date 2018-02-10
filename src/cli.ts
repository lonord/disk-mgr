#!/usr/bin/env node

import * as program from 'commander'
import * as debug from 'debug'
import { find } from 'lodash'
import mgr, { Configuration, DiskAlias, DiskDevice } from './'

// tslint:disable-next-line:no-var-requires
const pkg = require('../package.json')
const log = debug('disk-mgr:cli')

let handled = false

program
	.version(pkg.version)

program
	.command('ls')
	.description('list devices')
	.action(() => {
		handled = true
		wrapPromise(async () => {
			const disks = await mgr.listDisk()
			const aliasList = await mgr.listAlias()
			const table: Table = {
				columns: [
					'NAME',
					'LABEL',
					'MOUNTPOINT',
					'ALIAS'
				],
				rows: []
			}
			for (const d of disks) {
				table.rows.push([d.name, d.label || '', d.mountpoint || ''])
				if (d.children && d.children.length > 0) {
					for (const c of d.children) {
						const t = d.children[d.children.length - 1] === c ? '└─' : '├─'
						const alias = find(aliasList, { uuid: c.uuid })
						const aliasName = alias ? alias.alias : ''
						table.rows.push([t + c.name, c.label || '', c.mountpoint || '', aliasName])
					}
				}
			}
			console.log('')
			printTable(table)
			console.log('')
		})
	})

program
	.command('mount <device> <mountpoint>')
	.alias('m')
	.description('mount device, <device> could be dev|uuid|label')
	.action((device, mountpoint) => {
		handled = true
		wrapPromise(async () => {
			await mgr.mountDisk(device, mountpoint)
		})
	})

program
	.command('umount <device>')
	.alias('u')
	.description('ummount device, <device> could be dev|uuid|label')
	.option('-f, --force', 'force unmount (in case of an unreachable NFS system)')
	.action((device) => {
		handled = true
		wrapPromise(async () => {
			const args = []
			if (program.force) {
				args.push('-f')
			}
			await mgr.umountDisk(device, args)
		})
	})

program
	.command('add <dev> <aliasName>')
	.alias('a')
	.description('add alias name to a disk')
	.action((dev, aliasName) => {
		handled = true
		wrapPromise(async () => {
			const disks = await mgr.listDisk()
			const disk = findDisk(disks, dev)
			if (!disk) {
				throw new Error(`Could not find device '${dev}'`)
			}
			await mgr.addAlias({
				alias: aliasName,
				uuid: disk.uuid
			})
		})
	})

program
	.command('remove <aliasName>')
	.alias('r')
	.description('remove alias name of disk')
	.action((aliasName) => {
		handled = true
		wrapPromise(async () => {
			await mgr.removeAlias(aliasName)
		})
	})

program.parse(process.argv)

if (!handled) {
	program.help()
}

function wrapPromise(fn: () => Promise<void>) {
	fn().catch((err) => {
		console.error('')
		console.error(err.message || err)
		console.error('')
		log('error: %O', err)
	})
}

function findDisk(disks: DiskDevice[], dev: string) {
	for (const d of disks) {
		if (d.name === dev) {
			return d
		}
		if (d.children && d.children.length > 0) {
			const rd = findDisk(d.children, dev)
			if (rd) {
				return rd
			}
		}
	}
	return null
}

interface Table {
	columns: string[]
	rows: string[][]
}

function printTable(table: Table) {
	let colsWidth = table.columns.map((c) => c.length)
	table.rows.forEach((r) => {
		r.forEach((ri, i) => {
			if (ri.length > colsWidth[i]) {
				colsWidth[i] = ri.length
			}
		})
	})
	colsWidth = colsWidth.map((c) => c + 2)
	console.log(fillLine(table.columns, colsWidth))
	table.rows.forEach((r) => {
		console.log(fillLine(r, colsWidth))
	})
}

function fillLine(items: string[], widthList: number[]) {
	let s = ''
	for (let i = 0; i < items.length; i++) {
		const t = items[i]
		const w = widthList[i]
		s += fillCol(t, w)
	}
	return s
}

function fillCol(str: string, width: number) {
	width = width || 0
	while (str.length < width) {
		str = str + ' '
	}
	return str
}
