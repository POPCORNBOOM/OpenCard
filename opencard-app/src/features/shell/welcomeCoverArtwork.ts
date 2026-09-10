/**
 * 模块说明：
 * - 欢迎页背景封面墙使用的内置桌游封面素材
 * 职责边界：
 * - 只导出素材地址 不处理排布与展示 版权与出处见同目录 README.md
 */
import azul from '../../assets/welcome-covers/azul.jpg'
import catan from '../../assets/welcome-covers/catan.jpg'
import gloomhaven from '../../assets/welcome-covers/gloomhaven.jpg'
import love_letter from '../../assets/welcome-covers/love-letter.jpg'
import power_grid from '../../assets/welcome-covers/power-grid.jpg'
import scrabble from '../../assets/welcome-covers/scrabble.jpg'
import seven_wonders from '../../assets/welcome-covers/seven-wonders.png'
import small_world from '../../assets/welcome-covers/small-world.jpg'
import sushi_go from '../../assets/welcome-covers/sushi-go.jpg'
import terraforming_mars from '../../assets/welcome-covers/terraforming-mars.jpg'
import through_the_ages from '../../assets/welcome-covers/through-the-ages.jpg'
import ticket_to_ride from '../../assets/welcome-covers/ticket-to-ride.jpg'
import wingspan from '../../assets/welcome-covers/wingspan.jpg'
import reversewizard from '../../assets/welcome-covers/reverse-wizard.png'
import reversewizard2 from '../../assets/welcome-covers/reverse-wizard-2.png'

export const WELCOME_COVER_ARTWORK: readonly { readonly key: string, readonly src: string }[] = [
  { key: 'azul', src: azul },
  { key: 'catan', src: catan },
  { key: 'gloomhaven', src: gloomhaven },
  { key: 'love_letter', src: love_letter },
  { key: 'power_grid', src: power_grid },
  { key: 'scrabble', src: scrabble },
  { key: 'seven_wonders', src: seven_wonders },
  { key: 'small_world', src: small_world },
  { key: 'sushi_go', src: sushi_go },
  { key: 'terraforming_mars', src: terraforming_mars },
  { key: 'through_the_ages', src: through_the_ages },
  { key: 'ticket_to_ride', src: ticket_to_ride },
  { key: 'wingspan', src: wingspan },
  { key: 'reversewizard', src: reversewizard },
  { key: 'reversewizard2', src: reversewizard2 }
]
