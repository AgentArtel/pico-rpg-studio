import { RpgEvent, EventData, RpgPlayer } from '@rpgjs/server'
import { EmailItem } from '../items/EmailItem'

@EventData({
  name: 'mailbox',
  hitbox: { width: 32, height: 16 },
})
export default class MailboxEvent extends RpgEvent {
  async onAction(player: RpgPlayer) {
    const choiceObj = await player.showChoices('What would you like to do?', [
      { text: '📬 Get Mail', value: 'get' },
      { text: '✉️ Send Mail', value: 'send' },
      { text: 'Leave', value: 'leave' },
    ], { talkWith: this })

    const choice = typeof choiceObj === 'string' ? choiceObj : (choiceObj as { value?: string })?.value
    if (choice === 'leave') return

    if (choice === 'send') {
      await this.handleSendMail(player)
      return
    }

    // Get Mail (default)
    await this.handleGetMail(player)
  }

  private async handleGetMail(player: RpgPlayer) {
    await player.showText('📬 Checking mailbox...', { talkWith: this })

    try {
      const response = await fetch(
        `${process.env.SUPABASE_URL}/functions/v1/object-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            object_type: 'mailbox',
            action: 'fetch_emails',
            player_id: player.id,
          }),
        }
      )

      const result = await response.json()

      if (result.success) {
        const added = result.inventory_delta?.add || []
        let totalEmails = 0
        for (const item of added) {
          if (item.type === 'email') {
            player.addItem(EmailItem, item.count)
            totalEmails += item.count
          }
        }
        if (totalEmails > 0) {
          await player.showText(`✉️ Found ${totalEmails} new email${totalEmails > 1 ? 's' : ''}!`, { talkWith: this })
        } else {
          await player.showText('📭 No new emails.', { talkWith: this })
        }
      } else {
        const errorMsg = result.error?.message || 'Something went wrong'
        await player.showText(`❌ ${errorMsg}`, { talkWith: this })
      }
    } catch (error) {
      console.error('[Mailbox] Error:', error)
      await player.showText('❌ Mailbox is not working right now.', { talkWith: this })
    }
  }

  private async handleSendMail(player: RpgPlayer) {
    const to = await player.showTextInput('Who would you like to write to?', { talkWith: this })
    if (!to?.trim()) {
      await player.showText('Never mind then.', { talkWith: this })
      return
    }

    const subject = await player.showTextInput('What is the letter about?', { talkWith: this })
    if (!subject?.trim()) {
      await player.showText('You decided not to send an empty letter.', { talkWith: this })
      return
    }

    const body = await player.showTextInput('Write your message:', { talkWith: this, multiline: true })
    if (!body?.trim()) {
      await player.showText('You put the blank letter away.', { talkWith: this })
      return
    }

    const inputs = { to: to.trim(), subject: subject.trim(), body: body.trim() }

    try {
      const response = await fetch(
        `${process.env.SUPABASE_URL}/functions/v1/object-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            object_type: 'mailbox',
            action: 'send_email',
            player_id: player.id,
            inputs,
          }),
        }
      )

      const result = await response.json()

      if (result.success) {
        await player.showText('✉️ Your letter has been sent!', { talkWith: this })
      } else {
        await player.showText(`❌ Could not send: ${result.error?.message ?? 'Something went wrong'}`, { talkWith: this })
      }
    } catch (error) {
      console.error('[Mailbox] Send error:', error)
      await player.showText('❌ The postal service is having trouble.', { talkWith: this })
    }
  }
}
