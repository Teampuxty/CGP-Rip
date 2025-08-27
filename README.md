**CGP-Rip**

This tool is for downloading your **owned** CGP online books, into a PDF format.

This is in a BETA phase, and there will probably be bugs.


**Usage**

to setup, run the following commands in the root dir.

npm install
npm install --global typescript
tsc

To download a pdf, you will need a couple of things.

The bookID
  - Found within the url of the book.
    E.G For OCR Computer Science GCSE, the URL is "https://library.cgpbooks.co.uk/digitalaccess/COS43DF/Online/"
    This means the bookID is "COS43DF"
Your Session ID
  - Found within the Dev Console.
    Ctrl (cmd on mac) + Shift + I, then to the Application Tab, then click on cookies, and copy the value of "ASP.NET_SessionId"
Number of pages to download
  - Usually the total number of pages in the book. Used to be able to auto detect this, but CGP has reworked their whole systems.
UNI - Unique identifier for the svg text files.
  - Found within the Dev Console.
    Ctrl (cmd on mac) + Shift + I, then to the Network Tab, then click on any of the pages and copy the uni string at the end of the Request URL (Picture below)


    <img width="507" height="129" alt="image" src="https://github.com/user-attachments/assets/97ad520c-30dd-4220-965d-ed75be33e0bc" />



To run, execute the following command:
**node lib/cli.js -b <bookid> -p <pages> -q <quality (1-4) -u <UNI string>**

Please report any issues/feedback on the subreddit: https://www.reddit.com/r/CGP_RIP_support/



Credit: Stefanuk12 - Original creator of the project, of which no longer worked and I revived into this project.





