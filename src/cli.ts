#!/usr/bin/env node
// Dependencies
import { program } from "commander";
import * as fs from "fs";
import path from "path";
import { Book } from "./modules/Book.js";
import { FormatPageTemplate, VerboseLog } from "./modules/Utilities.js";
import chalk from "chalk";
import imageSize from "image-size";
import puppeteer from "puppeteer";
import PDFMerger from "pdf-merger-js";

// Load package metadata
const PackageData = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

// CLI metadata
program
  .name(PackageData.name)
  .description(PackageData.description)
  .version(PackageData.version);

// Configure session
program
  .command("configure")
  .description("Configure your CGP session")
  .argument("<session-id>", "ASP.NET_SessionId")
  .option("-f, --file <path>", "Path to config file", "config.json")
  .action((SessionId, options) => {
    const config = { "ASP.NET_SessionId": SessionId };
    fs.writeFileSync(options.file, JSON.stringify(config));
    console.log(chalk.bgGreen("Session configured"));
  });

// Rip book
program
  .command("rip")
  .description("Rip a CGP book to PDF")
  .option("-b, --book <id>", "Book ID")
  .option("-p, --pages <number>", "Number of pages to rip")
  .option("-q, --quality <level>", "Background quality (1–4)")
  .option("-u, --uni <token>", "UNI token for SVG access")
  .option("-f, --file <path>", "Path to config file", "config.json")
  .option("-o, --output <path>", "Output directory", "./output")
  .option("-v, --verbose", "Enable verbose output", true)
  .action(async (options) => {
    const { book, pages, quality, uni, file, output, verbose } = options;

    if (!book) throw new Error("Missing book ID. Use --book <id>");
    if (!pages || isNaN(parseInt(pages))) throw new Error("Invalid page count. Use --pages <number>");

    const parsedQuality = parseInt(quality);
    if (![1, 2, 3, 4].includes(parsedQuality)) {
      throw new Error("Quality must be between 1 and 4");
    }
    const typedQuality = parsedQuality as 1 | 2 | 3 | 4;

    const configPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(configPath)) {
      throw new Error("Config file not found. Run 'configure' first.");
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const { CloudFrontCookies } = await Book.GenerateCloudFront(book, config["ASP.NET_SessionId"]);
    const bookInstance = new Book({ BookId: book, CloudFront: CloudFrontCookies });

    const merger = new PDFMerger();
    const browser = await puppeteer.launch();
    const [page] = await browser.pages();

    async function BuildPage(i: number) {
      const SVGBuffer = await bookInstance.GetSVG(i, verbose, output, uni).catch(() => undefined);
      const ImageBuffer = await bookInstance.GetBackground(i, verbose, output, typedQuality);
      const SVGUrl = SVGBuffer && `data:image/svg+xml;base64,${SVGBuffer.toString("base64")}`;
      const ImageUrl = `data:image/${ImageBuffer.BackgroundFType.toLowerCase()};base64,${ImageBuffer.Background.toString("base64")}`;
      const dims = imageSize(ImageBuffer.Background);
      const html = FormatPageTemplate(dims.height?.toString() || "", dims.width?.toString() || "", ImageUrl, SVGUrl);
      VerboseLog(verbose, "Info", `Built HTML for page ${i}`);
      return { i, html, dims };
    }

    const Pages = parseInt(pages);
    const pageData = await Promise.all(Array.from({ length: Pages }, (_, i) => BuildPage(i + 1)));

    for (const { i, html, dims } of pageData) {
      if (!dims.height || !dims.width) {
        VerboseLog(verbose, "Error", `Missing dimensions for page ${i}`);
        continue;
      }
      await page.setContent(html);
      const pdfBuffer = await page.pdf({ height: dims.height, width: dims.width });
      await merger.add(Buffer.from(pdfBuffer));
      VerboseLog(verbose, "Success", `Added page ${i} to PDF`);
    }

    await browser.close();
    await merger.save(`${output}/${book}.pdf`);
    console.log(chalk.bgGreen("Book ripped successfully"));
  });

// Parse CLI input
program.parse(process.argv);
