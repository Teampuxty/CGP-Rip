#!/usr/bin/env node

// Dependencies
import { program } from "commander"
import * as fs from "fs"
import { Book } from "./modules/Book.js"
import { FormatPageTemplate, VerboseLog } from "./modules/Utilities.js"
import chalk from "chalk"
import imageSize from "image-size"
import puppeteer from "puppeteer"
import PDFMerger from "pdf-merger-js"

// Load package metadata
const PackageData = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"))

// CLI metadata
program
  .name(PackageData.name)
  .description(PackageData.description)
  .version(PackageData.version)

// Configure session
program
  .command("configure")
  .description("Configure your CGP session")
  .argument("<session-id>", "ASP.NET_SessionId")
  .option("-f, --file <path>", "Path to config file", "config.json")
  .action((SessionId, options) => {
    const config = { "ASP.NET_SessionId": SessionId }
    fs.writeFileSync(options.file, JSON.stringify(config))
    console.log(chalk.bgGreen("Session configured"))
  })

// Rip book
program
    .command("rip")
    .description("Rip a CGP book to PDF")
    .argument("<book-id>", "Book ID")
    .argument("<n.of.pages>", "Number of pages to rip")
    .argument("<quality (1-4)>", "Background quality (1–4)")
    .option("-v, --verbose", "Enable verbose output", true)
    .argument("<uni-token>", "UNI token for SVG access")
    .action(async (BookId, options) => {
    // Load session config
    if (!fs.existsSync(options.file)) {
      throw new Error("Config file not found. Run 'configure' first.")
    }

    const config = JSON.parse(fs.readFileSync(options.file, "utf-8"))
    const { CloudFrontCookies } = await Book.GenerateCloudFront(BookId, config["ASP.NET_SessionId"])
    const book = new Book({ BookId, CloudFront: CloudFrontCookies })

    // Validate page count
    const Pages = parseInt(options.pages)
    if (isNaN(Pages)) {
      throw new Error("Invalid page count. Use --pages <number>")
    }

    // Validate quality
    const Quality = parseInt(options.quality)
    if (![1, 2, 3, 4].includes(Quality)) {
      throw new Error("Quality must be between 1 and 4")
    }

    const Verbose = options.verbose
    const uniToken = options.uni || ""

    // Launch Puppeteer
    VerboseLog(Verbose, "Info", "Launching Puppeteer")
    const browser = await puppeteer.launch()
    const [page] = await browser.pages()
    const merger = new PDFMerger()

    // Build each page
    async function BuildPage(i: number) {
      const SVGBuffer = await book.GetSVG(i, Verbose, options.output, uniToken).catch(() => undefined)
      const ImageBuffer = await book.GetBackground(i, Verbose, options.output, Quality as 1 | 2 | 3 | 4)

      const SVGUrl = SVGBuffer && `data:image/svg+xml;base64,${SVGBuffer.toString("base64")}`
      const ImageUrl = `data:image/${ImageBuffer.BackgroundFType.toLowerCase()};base64,${ImageBuffer.Background.toString("base64")}`

      const dims = imageSize(ImageBuffer.Background)
      const html = FormatPageTemplate(dims.height?.toString() || "", dims.width?.toString() || "", ImageUrl, SVGUrl)

      VerboseLog(Verbose, "Info", `Built HTML for page ${i}`)
      return { i, html, dims }
    }

    // Process all pages
    const pages = await Promise.all(Array.from({ length: Pages }, (_, i) => BuildPage(i + 1)))

    for (const { i, html, dims } of pages) {
      if (!dims.height || !dims.width) {
        VerboseLog(Verbose, "Error", `Missing dimensions for page ${i}`)
        continue
      }

      await page.setContent(html)
      const pdfBuffer = await page.pdf({ height: dims.height, width: dims.width });
      await merger.add(Buffer.from(pdfBuffer));
      VerboseLog(Verbose, "Success", `Added page ${i} to PDF`)
    }

    await browser.close()
    await merger.save(`${options.output}/${BookId}.pdf`)
    console.log(chalk.bgGreen("Book ripped successfully"))
  })

// Parse CLI input
program.parse(process.argv)
