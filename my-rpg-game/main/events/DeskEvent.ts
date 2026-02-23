import { RpgEvent, EventData, RpgPlayer } from '@rpgjs/server'
import { EmailItem } from '../items/EmailItem'
import { TaggedEmailItem } from '../items/TaggedEmail'
import { SummaryItem } from '../items/Summary'
import { DraftEmailItem } from '../items/DraftEmail'
import { isRecording, appendStep } from '../services/workflowRecorder'

const ITEM_CLASS_MAP: Record<string, typeof EmailItem> = {
  'email': EmailItem,
  'tagged-email': TaggedEmailItem,
  'summary': SummaryItem,
  'draft-email': DraftEmailItem,
}

@EventData({
  name: 'desk',
  hitbox: { width: 32, height: 16 },
})
export default class DeskEvent extends RpgEvent {
  async onAction(player: RpgPlayer) {
    const choiceObj = await player.showChoices('The desk is covered in papers.', [
      { text: '📋 Process Mail', value: 'process' },
      { text: '🔍 Check Status', value: 'check' },
      { text: 'Leave', value: 'leave' },
    ], { talkWith: this })

    const choice = typeof choiceObj === 'string' ? choiceObj : (choiceObj as { value?: string })?.value
    if (choice === 'leave') return

    const action = choice === 'process' ? 'process_mail' : 'check_desk'

    try {
      await player.showText(
        choice === 'process' ? 'Organizing your letters...' : 'Checking the desk...',
        { talkWith: this }
      )

      const response = await fetch(
        `${process.env.SUPABASE_URL}/functions/v1/object-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            object_type: 'desk',
            action,
            player_id: player.id,
          }),
        }
      )

      const result = await response.json()

      if (result.success) {
        if (result.inventory_delta?.remove?.length) {
          for (const item of result.inventory_delta.remove) {
            const ItemClass = ITEM_CLASS_MAP[item.type]
            if (ItemClass) player.removeItem(ItemClass, item.count)
            else console.warn(`[Desk] No item class for type: ${item.type}`)
          }
        }
        if (result.inventory_delta?.add?.length) {
          for (const item of result.inventory_delta.add) {
            const ItemClass = ITEM_CLASS_MAP[item.type]
            if (ItemClass) player.addItem(ItemClass, item.count || 1)
            else console.warn(`[Desk] Unknown item type: ${item.type}`)
          }
        }
        await player.showText(result.message ?? 'Done.', { talkWith: this })
        if (isRecording(player.id)) {
          appendStep(player.id, {
            object_type: 'desk',
            action,
            params: {},
            expected_inputs: [],
            credentials_ref: 'google',
          })
        }
      } else {
        await player.showText(`❌ ${result.error?.message || 'Could not process'}`, { talkWith: this })
      }
    } catch (error) {
      console.error('[Desk] Error:', error)
      await player.showText('❌ The desk is cluttered.', { talkWith: this })
    }
  }
}
