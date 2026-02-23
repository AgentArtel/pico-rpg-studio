import { Item } from '@rpgjs/database'

@Item({
  name: 'Email',
  description: 'An unread email message',
  consumable: false,
  price: 0
})
export class EmailItem {}
