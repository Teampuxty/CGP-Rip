import chalk from "chalk"
import * as fs from "fs"

export function CreateFolder(Name: string) {
  if (!fs.existsSync(Name)) {
    fs.mkdirSync(Name, { recursive: true })
  }
}

const pageTemplate = fs.readFileSync("page.html", "utf-8")
export function FormatPageTemplate(Height: string, Width: string, ImagePath: string, VectorPath?: string) {
  let result = pageTemplate.replace("HEIGHT", Height).replace("WIDTH", Width).replace("IMAGEPATH", ImagePath)
  return result.replace("VECTORPATH", VectorPath || "")
}

export type LogType = "Success" | "Error" | "Warn" | "Neutral" | "Info"
export const LogColourChalk = {
  Success: chalk.green,
  Error: chalk.red,
  Warn: chalk.yellow,
  Neutral: chalk.white,
  Info: chalk.blue
}

export function VerboseLog(Verbose: boolean, Type: LogType, ...args: any[]) {
  if (!Verbose) return
  const Now = new Date()
  const Time = `${Now.getHours().toString().padStart(2, "0")}:${Now.getMinutes().toString().padStart(2, "0")}:${Now.getSeconds().toString().padStart(2, "0")}`
  const ColouredTime = chalk.magenta("[") + chalk.bold(Time) + chalk.magenta("]")
  const ChalkColour = LogColourChalk[Type]
  console.log(ColouredTime + " " + ChalkColour(...args))
}
