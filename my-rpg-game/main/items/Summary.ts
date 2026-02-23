import { Item } from '@rpgjs/database'

@Item({
  name: 'Summary',
  description: 'A summarised digest of processed emails',
  consumable: false,
  price: 0
})
export class SummaryItem {}
