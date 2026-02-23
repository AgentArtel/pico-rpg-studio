<template>
    <div class="player-hud">
        <div class="hud-panel">
            <div class="stat-row">
                <span class="stat-name">HP</span>
                <div class="bar-container">
                    <div class="bar-fill hp" :style="{ width: hpPercent + '%' }"></div>
                </div>
                <span class="stat-value">{{ currentHp }}/{{ maxHp }}</span>
            </div>
            <div class="stat-row">
                <span class="stat-name">MP</span>
                <div class="bar-container">
                    <div class="bar-fill mp" :style="{ width: mpPercent + '%' }"></div>
                </div>
                <span class="stat-value">{{ currentMp }}/{{ maxMp }}</span>
            </div>
            <div class="gold-row">
                <span class="gold-icon">🪙</span>
                <span class="gold-amount">{{ gold }}</span>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
export default {
    name: 'rpg-player-hud',
    inject: ['rpgGui'],
    props: ['currentHp', 'maxHp', 'currentMp', 'maxMp', 'gold'],
    computed: {
        hpPercent() {
            return this.maxHp > 0 ? (this.currentHp / this.maxHp) * 100 : 0
        },
        mpPercent() {
            return this.maxMp > 0 ? (this.currentMp / this.maxMp) * 100 : 0
        }
    },
    mounted() {
        // HUD stays open, doesn't stop inputs
        console.log('Player HUD mounted')
    }
}
</script>

<style scoped>
.player-hud {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 50;
}

.hud-panel {
    background: rgba(0, 0, 0, 0.8);
    border: 2px solid #c0c0c0;
    border-radius: 8px;
    padding: 12px;
    min-width: 200px;
    color: white;
    font-family: 'Courier New', monospace;
}

.stat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.stat-row:last-of-type {
    margin-bottom: 0;
}

.stat-name {
    width: 30px;
    font-weight: bold;
    font-size: 12px;
}

.bar-container {
    flex: 1;
    height: 12px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    overflow: hidden;
}

.bar-fill {
    height: 100%;
    transition: width 0.3s ease;
}

.bar-fill.hp {
    background: linear-gradient(90deg, #ff4444, #ff6666);
}

.bar-fill.mp {
    background: linear-gradient(90deg, #4444ff, #6666ff);
}

.stat-value {
    width: 60px;
    text-align: right;
    font-size: 12px;
}

.gold-row {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.gold-icon {
    font-size: 14px;
}

.gold-amount {
    font-size: 14px;
    color: #ffd700;
}
</style>
