<template>
    <div class="combat-menu">
        <div class="menu-window">
            <h2>Combat Menu</h2>
            <div class="menu-options">
                <div 
                    v-for="(option, index) in options" 
                    :key="index"
                    :class="['option', { selected: index === selectedIndex }]"
                    @click="selectOption(index)"
                >
                    {{ option.text }}
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Control } from '@rpgjs/client'

export default {
    name: 'rpg-combat-menu',
    inject: ['rpgEngine', 'rpgKeypress', 'rpgGuiClose'],
    data() {
        return {
            selectedIndex: 0,
            options: [
                { text: 'Attack', action: 'attack' },
                { text: 'Skills', action: 'skills' },
                { text: 'Items', action: 'items' },
                { text: 'Defend', action: 'defend' },
                { text: 'Flee', action: 'flee' }
            ]
        }
    },
    mounted() {
        this.rpgEngine.controls.stopInputs()
        this.obsKeyPress = this.rpgKeypress.subscribe(({ control }) => {
            if (!control) return
            
            switch (control.actionName) {
                case Control.Up:
                    this.selectedIndex = Math.max(0, this.selectedIndex - 1)
                    break
                case Control.Down:
                    this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1)
                    break
                case Control.Action:
                    this.executeAction()
                    break
                case Control.Back:
                    this.close()
                    break
            }
        })
    },
    methods: {
        selectOption(index: number) {
            this.selectedIndex = index
        },
        executeAction() {
            const action = this.options[this.selectedIndex].action
            console.log('Selected action:', action)
            // Send action to server
            this.close()
        },
        close() {
            this.rpgGuiClose('rpg-combat-menu')
            this.rpgEngine.controls.listenInputs()
        }
    },
    unmounted() {
        if (this.obsKeyPress) this.obsKeyPress.unsubscribe()
    }
}
</script>

<style scoped>
.combat-menu {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
    padding: 20px;
    z-index: 100;
}

.menu-window {
    background: rgba(0, 0, 0, 0.9);
    border: 3px solid #c0c0c0;
    border-radius: 8px;
    padding: 20px;
    min-width: 200px;
    color: white;
    font-family: 'Courier New', monospace;
}

.menu-window h2 {
    margin: 0 0 15px 0;
    font-size: 18px;
    text-align: center;
    color: #ffd700;
}

.menu-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.option {
    padding: 10px 15px;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.2s;
}

.option:hover,
.option.selected {
    background: rgba(255, 215, 0, 0.3);
    border-left: 3px solid #ffd700;
}
</style>
