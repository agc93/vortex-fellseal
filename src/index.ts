import path = require('path');
import { remote } from "electron";
// const { remote } = require('electron');

import { fs, log, util } from "vortex-api";
import { IExtensionContext, IDiscoveryResult, IState, ISupportedResult, ProgressDelegate, IInstallResult, IExtensionApi } from 'vortex-api/lib/types/api';
import { InstructionType, IInstruction } from 'vortex-api/lib/extensions/mod_management/types/IInstallResult';
import { ISteamEntry } from 'vortex-api/lib/util/api';

export const GAME_ID = 'fellsealarbitersmark'
export const STEAMAPP_ID = 699170;

export const rootIndicators = [
    'Encounters.txt',
    'GameOptions.txt',
    'Abilities.xml',
    'Jobs.xml'
]
let GAME_PATH = '';

export function findGame() {
    return util.steam.findByAppId(STEAMAPP_ID.toString())
        .then((game : ISteamEntry) => game.gamePath);
}


function getCustomDataPath() {
    return path.join(remote.app.getPath('documents'), 'Fell Seal', 'customdata');
}

//This is the main function Vortex will run when detecting the game extension. 
function main(context : IExtensionContext) {
    context.once(() => {
    });
    context.registerGame({
        name: "Fell Seal: Arbiter's Mark",
        mergeMods: true,
        logo: 'gameart.png',
        executable: () => 'Fell Seal.exe',
        supportedTools: [],
        requiredFiles: [
            'Fell Seal.exe'
        ],
        id: GAME_ID,
        queryPath: findGame,
        queryModPath: getCustomDataPath,
        setup: (discovery: IDiscoveryResult) => {
            log('debug', 'running fellseal setup')
            prepareForModding(discovery);
        },
        environment: {
            SteamAPPId: STEAMAPP_ID.toString(),
            gamepath: GAME_PATH
        },
        details: {
            steamAppId: STEAMAPP_ID
        }
    });
    
    context.registerInstaller(
        'fsam-customdata', 
        25, 
        testSupportedContent, 
        (files, destinationPath, gameId, progress) => installContent(files, destinationPath, gameId)
    );


    return true
}

/**
 * Preps the Fell Seal installation for mod deployment.
 * @remarks
 * Other than crating the user customdata folder, this is a basic sanity check only.
 *
 * @param discovery - The details for the discovered game.
 */
function prepareForModding(discovery : IDiscoveryResult) {
    GAME_PATH = discovery.path;
    let customPath = getCustomDataPath();
    return fs.ensureDirWritableAsync(customPath, () => Promise.resolve());
}

/**
 * Checks if the given mod files can be installed with this extension.
 * @remarks
 * This will currently accept anything as long as its for the right game.
 *
 * @param files - The list of mod files to test against
 * @param gameId - The current game ID to test against. Short-circuits if not fellsealarbitersmark.
 */
function testSupportedContent(files: string[], gameId: string): Promise<ISupportedResult> {
    log('debug', `files: ${files.length} [${files[0]}]`);
    // this should be more complicated but there doesn't seem to be a good way to determine what's a valid mod
    let supported = (gameId === GAME_ID);
    return Promise.resolve({
        supported,
        requiredFiles: [],
    });
}

/**
 * The main extension installer implementation.
 * @remarks
 * The main logic for this was mostly borrowed from agc93/beatvortex, silveredgold/vortex-sfm and emistro's extension so thanks respective authors
 *
 * @param api - The extension API.
 * @param files - The list of mod files for installation
 * @param gameId - The game ID for installation (should only ever be GAME_ID)
 * @param progressDelegate - Delegate for reporting progress (not currently used)
 *
 * @returns Install instructions for mapping mod files to output location.
 */
async function installContent(files: string[], destinationPath: string, gameId: string): Promise<IInstallResult> {
    log('debug', `running fell seal installer. [${gameId}]`, {files, destinationPath});
    //basically need to keep descending until we find a reliable indicator of mod root
    let firstType = path.dirname(files.find(f => rootIndicators.some(t => path.basename(f).indexOf(t) !== -1)));
    if (firstType) {
        // root vs firstType has to be right or we'll end up with extra layers of nesting.
        // let root = path.dirname(firstType);
        let root = firstType;
        const filtered = files.filter(file => (((root == "." ? true : (file.indexOf(root) !== -1)) && (!file.endsWith(path.sep)))));
        log('debug', 'filtered extraneous files', { root: root, candidates: filtered });
        const instructions = filtered.map(file => {
            const destination = file.substr(firstType.indexOf(path.basename(root)) + root.length).replace(/^\\+/g, '');
            return {
                type: 'copy' as InstructionType,
                source: file,
                // I don't think ⬇ conditional is needed, but frankly it works now and I'm afraid to touch it.
                destination: `${root == "." ? file : destination}`
            }
        });
        return Promise.resolve({ instructions });
    } else {
        log('warn', "Couldn't find reliable root indicator in file list. Falling back to basic installation!");
        var instructions = files.map((file: string): IInstruction => {
            return {
                type: 'copy',
                source: file,
                destination: file,
            };
        })
        return Promise.resolve({instructions});
    }
}




module.exports = {
    default: main,
};