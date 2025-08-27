import got from "got"
import { CreateFolder, VerboseLog } from "./Utilities.js"
import * as fs from "fs"
import { CookieJar } from "tough-cookie"

const prefixUrl = "https://library.cgpbooks.co.uk/digitalcontent/"
export const HttpClientAgent = got.extend({
  prefixUrl,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36 OPR/91.0.4516.36"
  }
})

export interface ICloudFront {
  "CloudFront-Signature": string
  "CloudFront-Policy": string
  "CloudFront-Key-Pair-Id": string
}

export interface IBook {
  BookId: string
  CloudFront: ICloudFront
}

export class Book {
  BookId: string = ""
  CloudFront: ICloudFront = {
    "CloudFront-Signature": "",
    "CloudFront-Policy": "",
    "CloudFront-Key-Pair-Id": ""
  }

  constructor(Data: IBook) {
    Object.assign(this, Data)
  }

  static async GenerateCloudFront(BookId: string, SessionId: string) {
    const Response = await got.post(`https://library.cgpbooks.co.uk/digitalaccess/${BookId}/Online`, {
      headers: {
        cookie: `ASP.Net_SessionId=${SessionId}`
      },
      form: {
        UserGuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa",
        Signature: Math.random().toString(36).slice(2, 42)
      }
    })

    const SetCookies = Response.headers["set-cookie"]
    if (!SetCookies) throw new Error("Did not get set-cookie")

    const SetCookiesTrimmed = SetCookies.map(v => v.substring(0, v.indexOf(";")))
    const CloudFrontCookies: ICloudFront = {
      "CloudFront-Signature": "",
      "CloudFront-Policy": "",
      "CloudFront-Key-Pair-Id": ""
    }

    SetCookiesTrimmed.forEach(cookie => {
      const [name, value] = cookie.split("=")
      if (name in CloudFrontCookies)
        CloudFrontCookies[name as keyof typeof CloudFrontCookies] = value
    })

    return { CloudFrontCookies, SetCookiesTrimmed }
  }

  getJar(currentUrl: string = prefixUrl) {
    const jar = new CookieJar()
    jar.setCookieSync(`CloudFront-Signature=${this.CloudFront["CloudFront-Signature"]}`, currentUrl)
    jar.setCookieSync(`CloudFront-Policy=${this.CloudFront["CloudFront-Policy"]}`, currentUrl)
    jar.setCookieSync(`CloudFront-Key-Pair-Id=${this.CloudFront["CloudFront-Key-Pair-Id"]}`, currentUrl)
    return jar
  }

  async GetSVG(Page: number, Verbose: boolean = true, OutputDirectory?: string, uniToken?: string) {
    const ZeroPadded = Page.toString().padStart(4, "0")
    const URL = `${this.BookId}/assets/common/page-vectorlayers/${ZeroPadded}.svg${uniToken ? `?uni=${uniToken}` : ""}`

    VerboseLog(Verbose, "Info", `Attempting to get SVG for ${this.BookId}:${Page}`)
    const SVG = await HttpClientAgent(URL, { cookieJar: this.getJar() }).buffer()
    VerboseLog(Verbose, "Success", `Got SVG for ${this.BookId}:${Page}`)

    if (OutputDirectory) {
      CreateFolder(`${OutputDirectory}/svgs`)
      const OutputFolder = `${OutputDirectory}/svgs/${this.BookId}`
      CreateFolder(OutputFolder)
      fs.writeFileSync(`${OutputFolder}/page-${ZeroPadded}.svg`, SVG)
    }

    return SVG
  }

  async GetBackground(Page: number, Verbose: boolean = true, OutputDirectory?: string, quality: 1 | 2 | 3 | 4 = 4) {
    const ZeroPadded = Page.toString().padStart(4, "0")
    const URL = `${this.BookId}/assets/common/page-html5-substrates/page${ZeroPadded}_${quality}.`
    const cookieJar = this.getJar()

    VerboseLog(Verbose, "Info", `Attempting to get background for ${this.BookId}:${Page}`)
    let BackgroundFType: "PNG" | "JPEG" = "JPEG"
    const Background = await HttpClientAgent(URL + "jpg", { cookieJar }).buffer().catch(async () => {
      BackgroundFType = "PNG"
      return await HttpClientAgent(URL + "png", { cookieJar }).buffer()
    })
    VerboseLog(Verbose, "Success", `Got background for ${this.BookId}:${Page}`)

    if (OutputDirectory) {
      CreateFolder(`${OutputDirectory}/bgs`)
      const OutputFolder = `${OutputDirectory}/bgs/${this.BookId}`
      CreateFolder(OutputFolder)
      fs.writeFileSync(`${OutputFolder}/page-${ZeroPadded}.${BackgroundFType}`, Background)
    }

    return { Background, BackgroundFType }
  }
}
