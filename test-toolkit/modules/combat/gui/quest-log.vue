<template>
    <div class="quest-log">
        <div class="quest-window">
            <h2>Quest Log</h2>
            <div class="quest-list">
                <div 
                    v-for="quest in displayQuests" 
                    :key="quest.id" 
                    :class="['quest-item', quest.status]"
                >
                    <div class="quest-header">
                        <span class="quest-name">{{ quest.name }}</span>
                        <span class="quest-status">{{ formatStatus(quest.status) }}</span>
                    </div>
                    <p class="quest-description">{{ quest.description }}</p>
                    <div v-if="quest.objectives" class="quest-objectives">
                        <div 
                            v-for="(obj, idx) in quest.objectives" 
                            :key="idx"
                            class="objective"
                        >
                            <span class="checkbox">{{ obj.completed ? '☑' : '☐' }}</span>
                            <span :class="{ completed: obj.completed }">{{ obj.text }}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="close-hint">Press ESC to close</div>
        </div>
    </div>
</template>

<script lang="ts">
import { Control } from '@rpgjs/client'

export default {
    name: 'rpg-quest-log',
    inject: ['rpgEngine', 'rpgKeypress', 'rpgGuiClose', 'rpgStage'],
    props: {
        quests: {
            type: Array,
            default: () => []
        }
    },
    computed: {
        displayQuests() {
            return (this.quests && this.quests.length > 0)
                ? this.quests
                : [
                    { id: 'sample1', name: 'Defeat the Slimes', description: 'Help the village by defeating 5 slimes.', status: 'active', objectives: [{ text: 'Defeat slimes (0/5)', completed: false }] },
                    { id: 'sample2', name: 'Find the Lost Sword', description: 'Find the iron sword lost in the forest.', status: 'completed', objectives: [{ text: 'Search the forest', completed: true }, { text: 'Return the sword', completed: true }] }
                ]
        }
    },
    mounted() {
        this.rpgEngine.controls.stopInputs()
        
        // Add blur effect
        const blur = new this.rpgEngine.PIXI.BlurFilter()
        this.rpgStage.filters = [blur]
        
        this.obsKeyPress = this.rpgKeypress.subscribe(({ control }) => {
            if (control?.actionName == Control.Back) {
                this.close()
            }
        })
    },
    methods: {
        formatStatus(status: string) {
            const statusMap: Record<string, string> = {
                active: 'Active',
                completed: 'Completed',
                failed: 'Failed'
            }
            return statusMap[status] || status
        },
        close() {
            this.rpgStage.filters = null
            this.rpgGuiClose('rpg-quest-log')
            this.rpgEngine.controls.listenInputs()
        }
    },
    unmounted() {
        if (this.obsKeyPress) this.obsKeyPress.unsubscribe()
    }
}
</script>

<style scoped>
.quest-log {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
}

.quest-window {
    background: rgba(0, 0, 0, 0.95);
    border: 3px solid #c0c0c0;
    border-radius: 12px;
    padding: 25px;
    width: 500px;
    max-height: 70vh;
    overflow-y: auto;
    color: white;
    font-family: 'Courier New', monospace;
}

.quest-window h2 {
    margin: 0 0 20px 0;
    font-size: 24px;
    text-align: center;
    color: #ffd700;
    border-bottom: 2px solid #ffd700;
    padding-bottom: 10px;
}

.quest-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.quest-item {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 15px;
    border-left: 4px solid #ffd700;
}

.quest-item.completed {
    border-left-color: #44ff44;
    opacity: 0.7;
}

.quest-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.quest-name {
    font-weight: bold;
    font-size: 16px;
}

.quest-status {
    font-size: 12px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 215, 0, 0.2);
}

.quest-item.completed .quest-status {
    background: rgba(68, 255, 68, 0.2);
}

.quest-description {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #ccc;
}

.quest-objectives {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.objective {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
}

.checkbox {
    font-size: 14px;
}

.objective .completed {
    text-decoration: line-through;
    color: #888;
}

.close-hint {
    text-align: center;
    margin-top: 20px;
    font-size: 12px;
    color: #888;
}
</style>
