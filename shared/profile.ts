// 個人連結與聯絡資訊：Footer（ContactBoard）與側選單（SideMenu）共用，修改網址只需改這裡

export interface LinkItem {
  label: string
  url: string
}

// 求職平台與作品集
export const CAREER_LINKS: LinkItem[] = [
  { label: 'Yourator', url: 'https://www.yourator.co/resumes/5bea676ce3e10aea4b8516def501135d' },
  { label: 'CakeResume', url: 'https://www.cake.me/cj654vmp' },
  { label: 'CakeResume Portfolio', url: 'https://www.cake.me/me/cj654vmp/portfolios?ref=dashboard_navs_portfolio' },
  { label: 'Behance', url: 'https://www.behance.net/cj654vmp2069' },
  { label: 'GitHub', url: 'https://github.com/HuJhihSyun' }
]

// 社群媒體
export const SOCIAL_LINKS: LinkItem[] = [
  { label: 'Facebook', url: 'https://www.facebook.com/jhihsyun.hu/' },
  { label: 'Instagram', url: 'https://www.instagram.com/hujhihsyun/' },
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/jhih-syun-hu-339b4b172/' },
  { label: 'LINE', url: 'https://line.me/ti/p/gUXVTpmfYh' }
]

export const CONTACT = {
  email: 'cj654vmp@gmail.com',
  tel: '0988-565-853',
  telHref: 'tel:+886988565853'
}
