/**
 * @name CompleteDiscordQuest
 * @version 0.0.4
 * @description A BetterDiscord plugin to complete Discord quests without doing the tasks.
 * @author Tahsin (@tahsin_ahmed62)
 * @source https://github.com/tvhsin/BetterDiscordStuff
 * @license Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0)
 */

module.exports = class CompleteDiscordQuest {
    start() {
        // Notify the user that the plugin has started
        BdApi.UI.showNotice("CompleteDiscordQuest plugin started! It will wait 10 seconds before checking for claimed quests.", { type: "info" });

        // Check if settings are open and prompt the user to close them
        if (document.querySelector('.bd-settings-title')) {
            BdApi.UI.alert("CompleteDiscordQuest", "Plugin started! Please close settings.", {
                buttons: [
                    {
                        label: "Close Settings",
                        onClick: () => {
                            document.querySelector('.bd-settings-title').closest('.bd-modal').querySelector('.bd-modal-close').click();
                        }
                    }
                ]
            });
        }

        // Run the main script
        this.runScript();
    }

    stop() {
        // Notify the user that the plugin has stopped
        BdApi.UI.showToast("CompleteDiscordQuest plugin stopped!", { type: "info" });

        // Show a popup informing the user that the script will still run until Discord is restarted
        BdApi.UI.showConfirmationModal("Plugin Stopped", "The script will still run until you restart Discord. Would you like to restart Discord now?", {
            confirmText: "Restart Discord",
            cancelText: "Later",
            onConfirm: () => {
                location.reload();
            }
        });
    }

    async runScript() {
        // Remove jQuery from the window object
        delete window.$;

        // Load webpack modules
        let wpRequire;
        window.webpackChunkdiscord_app.push([[ Math.random() ], {}, (req) => { wpRequire = req; }]);

        // Delay to ensure quests are loaded
        await this.delay(10000);

        // Get necessary stores and API
        const { ApplicationStreamingStore, RunningGameStore, QuestsStore, ChannelStore, GuildChannelStore, FluxDispatcher, api } = this.loadStores(wpRequire);

        // Find an uncompleted quest
        const quest = this.findUncompletedQuest(QuestsStore);
        const isApp = navigator.userAgent.includes("Electron/");

        if (!quest) {
            this.handleNoQuests();
        } else {
            this.handleQuest(quest, api, RunningGameStore, FluxDispatcher, ApplicationStreamingStore, ChannelStore, GuildChannelStore, isApp);
        }
    }

    loadStores(wpRequire) {
        return {
            ApplicationStreamingStore: Object.values(wpRequire.c).find(x => x?.exports?.Z?.getStreamerActiveStreamMetadata).exports.Z,
            RunningGameStore: Object.values(wpRequire.c).find(x => x?.exports?.ZP?.getRunningGames).exports.ZP,
            QuestsStore: Object.values(wpRequire.c).find(x => x?.exports?.Z?.getQuest).exports.Z,
            ChannelStore: Object.values(wpRequire.c).find(x => x?.exports?.Z?.getAllThreadsForParent).exports.Z,
            GuildChannelStore: Object.values(wpRequire.c).find(x => x?.exports?.ZP?.getSFWDefaultChannel).exports.ZP,
            FluxDispatcher: Object.values(wpRequire.c).find(x => x?.exports?.Z?.flushWaitQueue).exports.Z,
            api: Object.values(wpRequire.c).find(x => x?.exports?.tn?.get).exports.tn
        };
    }

    findUncompletedQuest(QuestsStore) {
        return [...QuestsStore.quests.values()].find(x => x.id !== "1248385850622869556" && x.userStatus?.enrolledAt && !x.userStatus?.completedAt && new Date(x.config.expiresAt).getTime() > Date.now());
    }

    handleNoQuests() {
        console.log("You don't have any uncompleted quests!");
        BdApi.UI.showConfirmationModal("No Quests Left", "You don't have any claimed incomplete quests. Would you like to disable CompleteDiscordQuest and restart discord?", {
            confirmText: "Yes",
            cancelText: "No, keep plugin enabled.",
            onConfirm: () => {
                BdApi.Plugins.disable("CompleteDiscordQuest");
                location.reload();
            },
            onCancel: () => {
                BdApi.UI.showNotice("You don't have any uncompleted quests!", { 
                    type: "info",
                    buttons: [
                        {
                            label: "Disable Plugin & Restart Discord",
                            onClick: () => {
                                BdApi.Plugins.disable("CompleteDiscordQuest");
                                location.reload();
                            }
                        }
                    ]
                });
            }
        });
    }

    handleQuest(quest, api, RunningGameStore, FluxDispatcher, ApplicationStreamingStore, ChannelStore, GuildChannelStore, isApp) {
        const pid = Math.floor(Math.random() * 30000) + 1000;
        const applicationId = quest.config.application.id;
        const applicationName = quest.config.application.name;
        const taskName = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY"].find(x => quest.config.taskConfig.tasks[x] != null);
        const secondsNeeded = quest.config.taskConfig.tasks[taskName].target;
        const secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;

        if (taskName === "WATCH_VIDEO") {
            this.handleWatchVideoQuest(api, quest, secondsNeeded, secondsDone, applicationName);
        } else if (taskName === "PLAY_ON_DESKTOP") {
            this.handlePlayOnDesktopQuest(api, RunningGameStore, FluxDispatcher, quest, applicationId, applicationName, pid, isApp, secondsNeeded, secondsDone);
        } else if (taskName === "STREAM_ON_DESKTOP") {
            this.handleStreamOnDesktopQuest(ApplicationStreamingStore, FluxDispatcher, quest, applicationId, pid, isApp, secondsNeeded, secondsDone, applicationName);
        } else if (taskName === "PLAY_ACTIVITY") {
            this.handlePlayActivityQuest(api, ChannelStore, GuildChannelStore, quest, secondsNeeded, applicationName);
        }
    }

    async handleWatchVideoQuest(api, quest, secondsNeeded, secondsDone, applicationName) {
        // Handle WATCH_VIDEO quest type
        const tolerance = 2, speed = 10;
        const diff = Math.floor((Date.now() - new Date(quest.userStatus.enrolledAt).getTime()) / 1000);
        const startingPoint = Math.min(Math.max(Math.ceil(secondsDone), diff), secondsNeeded);
        let fn = async () => {
            for (let i = startingPoint; i <= secondsNeeded; i += speed) {
                try {
                    await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: Math.min(secondsNeeded, i + Math.random()) } });
                    this.showProgressNotice(`Quest progress: ${i}/${secondsNeeded}`);
                } catch (ex) {
                    console.log("Failed to send increment of", i, ex.message);
                }
                await this.delay(tolerance * 1000);
            }
            if ((secondsNeeded - secondsDone) % speed !== 0) {
                await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: secondsNeeded } });
            }
            this.showCompletionNotice("Quest completed!");
        };
        fn();
        this.showProgressNotice(`Spoofing video for ${applicationName}. Wait for ${Math.ceil((secondsNeeded - startingPoint) / speed * tolerance)} more seconds.`);
    }

    handlePlayOnDesktopQuest(api, RunningGameStore, FluxDispatcher, quest, applicationId, applicationName, pid, isApp, secondsNeeded, secondsDone) {
        // Handle PLAY_ON_DESKTOP quest type
        if (!isApp) {
            this.showErrorNotice("This no longer works in browser for non-video quests. Use the desktop app to complete the quest!");
            return;
        }

        api.get({ url: `/applications/public?application_ids=${applicationId}` }).then(res => {
            const appData = res.body[0];
            const exeName = appData.executables.find(x => x.os === "win32").name.replace(">", "");

            const games = RunningGameStore.getRunningGames();
            const fakeGame = this.createFakeGame(appData, exeName, applicationId, pid);
            games.push(fakeGame);
            FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [], added: [fakeGame], games: games });

            let fn = data => {
                let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value);
                this.showProgressNotice(`Quest progress: ${progress}/${secondsNeeded}`);

                if (progress >= secondsNeeded) {
                    this.showCompletionNotice("Quest completed!");

                    const idx = games.indexOf(fakeGame);
                    if (idx > -1) {
                        games.splice(idx, 1);
                        FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: [] });
                    }
                    FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                }
            };
            FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);

            BdApi.UI.showNotice(`Spoofed your game to ${applicationName}. Wait for ${Math.ceil((secondsNeeded - secondsDone) / 60)} more minutes.`);
        });
    }

    handleStreamOnDesktopQuest(ApplicationStreamingStore, FluxDispatcher, quest, applicationId, pid, isApp, secondsNeeded, secondsDone, applicationName) {
        // Handle STREAM_ON_DESKTOP quest type
        if (!isApp) {
            this.showErrorNotice("This no longer works in browser for non-video quests. Use the desktop app to complete the quest!");
            return;
        }

        let realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
        ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
            id: applicationId,
            pid,
            sourceName: null
        });

        let fn = data => {
            let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.STREAM_ON_DESKTOP.value);
            this.showProgressNotice(`Quest progress: ${progress}/${secondsNeeded}`);

            if (progress >= secondsNeeded) {
                this.showCompletionNotice("Quest completed!");

                ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
                FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
            }
        };
        FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);

        BdApi.UI.showNotice(`Spoofed your stream to ${applicationName}. Stream any window in vc for ${Math.ceil((secondsNeeded - secondsDone) / 60)} more minutes.`);
        BdApi.UI.showNotice("Remember that you need at least 1 other person to be in the vc!");
    }

    async handlePlayActivityQuest(api, ChannelStore, GuildChannelStore, quest, secondsNeeded, applicationName) {
        // Handle PLAY_ACTIVITY quest type
        const channelId = ChannelStore.getSortedPrivateChannels()[0]?.id ?? Object.values(GuildChannelStore.getAllGuilds()).find(x => x != null && x.VOCAL.length > 0).VOCAL[0].channel.id;
        const streamKey = `call:${channelId}:1`;

        let fn = async () => {
            console.log("Completing quest", applicationName, "-", quest.config.messages.questName);

            while (true) {
                const res = await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: false } });
                const progress = res.body.progress.PLAY_ACTIVITY.value;
                this.showProgressNotice(`Quest progress: ${progress}/${secondsNeeded}`);

                await this.delay(20000);

                if (progress >= secondsNeeded) {
                    await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: true } });
                    break;
                }
            }

            this.showCompletionNotice("Quest completed!");
        };
        fn();
    }

    createFakeGame(appData, exeName, applicationId, pid) {
        return {
            cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
            exeName,
            exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
            hidden: false,
            isLauncher: false,
            id: applicationId,
            name: appData.name,
            pid: pid,
            pidPath: [pid],
            processName: appData.name,
            start: Date.now(),
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showProgressNotice(message) {
        BdApi.UI.showToast(message, { type: "info", timeout: 2000 });
    }

    showCompletionNotice(message) {
        BdApi.UI.showNotice(message, { type: "success" });
    }

    showErrorNotice(message) {
        BdApi.UI.showNotice(message, { type: "error" });
    }
};
