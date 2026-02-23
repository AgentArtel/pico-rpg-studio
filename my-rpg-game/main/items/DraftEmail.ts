import { Item } from '@rpgjs/database'

@Item({
  name: 'Draft Email',
  description: 'An email you have written, ready to send',
  consumable: false,
  price: 0
})
export class DraftEmailItem {}
