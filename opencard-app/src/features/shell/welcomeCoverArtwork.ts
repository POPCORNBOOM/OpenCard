/**
 * 模块说明：
 * - 欢迎页背景封面墙使用的内置桌游封面素材
 * 职责边界：
 * - 只导出素材地址 不处理排布与展示 版权与出处见同目录 README.md
 * - 第三方素材的 key 与文件名统一使用恶搞名 避免直接出现原作品名称
 * - reverse-wizard 两张是项目自有素材 沿用原名
 */
import azzul from '../../assets/welcome-covers/azzul.jpg'
import bloomhaven from '../../assets/welcome-covers/bloomhaven.jpg'
import katan from '../../assets/welcome-covers/katan.jpg'
import love_email from '../../assets/welcome-covers/love-email.jpg'
import power_greed from '../../assets/welcome-covers/power-greed.jpg'
import reversewizard from '../../assets/welcome-covers/reverse-wizard.png'
import reversewizard2 from '../../assets/welcome-covers/reverse-wizard-2.png'
import scramble from '../../assets/welcome-covers/scramble.jpg'
import seven_blunders from '../../assets/welcome-covers/seven-blunders.png'
import sushi_slow from '../../assets/welcome-covers/sushi-slow.jpg'
import tall_world from '../../assets/welcome-covers/tall-world.jpg'
import terraforming_cars from '../../assets/welcome-covers/terraforming-cars.jpg'
import through_the_rages from '../../assets/welcome-covers/through-the-rages.jpg'
import ticket_to_hide from '../../assets/welcome-covers/ticket-to-hide.jpg'
import wingspam from '../../assets/welcome-covers/wingspam.jpg'

export const WELCOME_COVER_ARTWORK: readonly { readonly key: string, readonly src: string }[] = [
  { key: 'azzul', src: azzul },
  { key: 'katan', src: katan },
  { key: 'bloomhaven', src: bloomhaven },
  { key: 'love_email', src: love_email },
  { key: 'power_greed', src: power_greed },
  { key: 'scramble', src: scramble },
  { key: 'seven_blunders', src: seven_blunders },
  { key: 'tall_world', src: tall_world },
  { key: 'sushi_slow', src: sushi_slow },
  { key: 'terraforming_cars', src: terraforming_cars },
  { key: 'through_the_rages', src: through_the_rages },
  { key: 'ticket_to_hide', src: ticket_to_hide },
  { key: 'wingspam', src: wingspam },
  { key: 'reversewizard', src: reversewizard },
  { key: 'reversewizard2', src: reversewizard2 }
]
