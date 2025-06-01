// Helper function to scrape the JobStreet job detail panel
// IMPORTANT: Selectors in this function (especially data-automation attributes)
// need to be verified against the LIVE JobStreet job detail page structure.
async function scrapeJobStreetJobDetailPanel(basicInfo = {}) {
  try {
    // Job details panel selector - CRITICAL: VERIFY THIS ON LIVE SITE.
    // Based on jobstreet.html, 'data-metrics-identifier' seems more likely than 'data-automation'.
    const detailPanelSelector = '[data-metrics-identifier="jobDetailsPage"]'; // Potential new selector
    // const detailPanelSelector = '[data-automation="jobDetailsPage"]'; // Old selector
    let panel = document.querySelector(detailPanelSelector);

    if (!panel) {
      console.log(
        `JobStreet job details panel ("${detailPanelSelector}") not found on first attempt. Retrying after 0.5s...`
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
      panel = document.querySelector(detailPanelSelector);
    }

    if (!panel) {
      console.warn(
        `JobStreet job details panel ("${detailPanelSelector}") not found after retry. Returning basic info or null.`
      );
      if (basicInfo.title && basicInfo.company && basicInfo.jobUrl) {
        return Job.createFromJobStreet(basicInfo);
      }
      return null;
    }

    // Title - VERIFY SELECTOR ON LIVE DETAIL PANEL
    const titleElement = panel.querySelector(
      '[data-automation="job-detail-title"], h1' // Common SEEK/JobStreet patterns
    );
    const title = titleElement
      ? titleElement.textContent.trim()
      : basicInfo.title || "";

    // Company name - VERIFY SELECTOR ON LIVE DETAIL PANEL
    const companyElement = panel.querySelector(
      '[data-automation="advertiser-name"]' // Common SEEK/JobStreet pattern
    );
    const company = companyElement
      ? companyElement.textContent.trim()
      : basicInfo.company || "";

    // Location - VERIFY SELECTOR ON LIVE DETAIL PANEL
    const locationElement = panel.querySelector(
      '[data-automation="job-detail-location"]' // Common SEEK/JobStreet pattern
    );
    const location = locationElement
      ? locationElement.textContent.trim()
      : basicInfo.location || "";

    // Job URL - use the current URL or the one from the basic info
    const jobUrl = basicInfo.jobUrl || window.location.href.split("?")[0] || "";

    // Work type (Full-time/Part-time) - VERIFY SELECTOR ON LIVE DETAIL PANEL
    const workTypeElement = panel.querySelector(
      '[data-automation="job-detail-work-type"]' // Common SEEK/JobStreet pattern
    );
    const jobType = workTypeElement ? workTypeElement.textContent.trim() : "";

    // Salary info - VERIFY SELECTOR ON LIVE DETAIL PANEL
    const salaryElement = panel.querySelector(
      '[data-automation="job-detail-salary"]' // Common SEEK/JobStreet pattern
    );
    const salary = salaryElement ? salaryElement.textContent.trim() : "";

    // Posted date - VERIFY SELECTOR ON LIVE DETAIL PANEL
    let postedDate = basicInfo.postedDate || "";
    // Example: const postedDatePanelElement = panel.querySelector('[data-automation="job-posted-date"]'); // VERIFY
    // if (postedDatePanelElement) { postedDate = postedDatePanelElement.textContent.trim(); }

    // Job description - VERIFY SELECTOR ON LIVE DETAIL PANEL
    const descriptionElement = panel.querySelector(
      '[data-automation="jobAdDetails"]' // Common SEEK/JobStreet pattern
    );
    const description = descriptionElement
      ? descriptionElement.innerText.replace(/\n{3,}/g, "\n\n").trim()
      : basicInfo.description || "";

    // Company logo - VERIFY SELECTORS ON LIVE DETAIL PANEL
    const logoElement = panel.querySelector(
      '[data-testid="bx-logo-image"] img, [data-automation="advertiser-logo"] img' // Common SEEK/JobStreet patterns
    );
    const companyLogoUrl = logoElement
      ? logoElement.src
      : basicInfo.companyLogoUrl || null;

    // Workplace Type (Remote, Hybrid, On-site) - Initialize from basicInfo and try to find in panel
    let workplaceType = basicInfo.workplaceType || "";
    // TODO: VERIFY AND ADD LOGIC to find workplaceType in the panel if available.
    // Example:
    // const workplaceTypePanelElement = panel.querySelector('[data-automation="job-workplace-type"]'); // VERIFY this selector
    // if (workplaceTypePanelElement) {
    //   workplaceType = workplaceTypePanelElement.textContent.trim();
    // } else if (location) { // Fallback: Infer from location text if possible
    //   if (location.toLowerCase().includes('remote')) workplaceType = 'Remote';
    //   else if (location.toLowerCase().includes('hybrid')) workplaceType = 'Hybrid';
    //   else if (location) workplaceType = 'On-site'; // Default if location exists
    // }

    const job = Job.createFromJobStreet({
      title,
      company,
      location,
      jobUrl,
      description,
      salary,
      postedDate,
      companyLogoUrl,
      jobType,
      workplaceType,
      applicantCount: "", // JobStreet might not provide this easily
    });

    console.log("Scraped JobStreet job detail from panel:", job);
    return job;
  } catch (error) {
    console.error("Error scraping JobStreet job details panel:", error);
    if (basicInfo.title && basicInfo.company && basicInfo.jobUrl) {
      return Job.createFromJobStreet(basicInfo);
    }
    return null;
  }
}

// JobStreet scraper object
const jobstreetScraper = {
  isMatch: (url) => url.includes("my.jobstreet.com"),

  scrapeJobList: async () => {
    const jobs = [];
    console.log("=== JobStreet Scraping Started ===");
    console.log("Current URL:", window.location.href);

    const jobCardSelectors = [
      'article[data-testid="job-card"]',
      'article[data-card-type="JobCard"]',
      'article[data-automation="normalJob"]',
    ];

    let jobNodes = [];
    for (const selector of jobCardSelectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      if (nodes.length > 0) {
        jobNodes = nodes;
        console.log(
          `Using selector for job cards: "${selector}", found ${nodes.length} nodes.`
        );
        break;
      }
    }

    if (jobNodes.length === 0) {
      console.log("No job cards found with any of the specified selectors.");
    }
    console.log("Found JobStreet job nodes:", jobNodes.length);

    // CRITICAL: VERIFY jobDetailsPage selector on live site for this check.
    // Using the same potential new selector as in scrapeJobStreetJobDetailPanel.
    const detailPanelSelector = '[data-metrics-identifier="jobDetailsPage"]';
    const alreadyOnJobDetail = document.querySelector(detailPanelSelector);

    if (alreadyOnJobDetail && jobNodes.length === 0) {
      console.log("On standalone job details page, scraping current job.");
      const jobDetail = await scrapeJobStreetJobDetailPanel({});
      if (jobDetail) {
        jobs.push(jobDetail);
      }
      return { jobs, nextUrl: null };
    }

    const waitForJobDetailsPanel = async () => {
      let attempts = 0;
      const maxAttempts = 20;
      let waitTime = 200;

      while (attempts < maxAttempts) {
        // CRITICAL: VERIFY these selectors on live site.
        const detailsPanel = document.querySelector(detailPanelSelector); // Using updated selector
        const loadingIndicator = document.querySelector(
          // VERIFY this loading indicator on live site
          '[data-automation="loading-spinner"]' // Or other class/attribute JobStreet uses
        );

        if (detailsPanel && !loadingIndicator) {
          await new Promise((r) => setTimeout(r, 500));
          return true;
        }

        waitTime = Math.min(waitTime * 1.5, 1500);
        console.log(
          `Waiting ${waitTime.toFixed(0)}ms for job details panel (attempt ${
            attempts + 1
          }/${maxAttempts})`
        );
        await new Promise((r) => setTimeout(r, waitTime));
        attempts++;
      }
      console.warn("Timeout waiting for job details panel.");
      return false;
    };

    for (let i = 0; i < Math.min(jobNodes.length, 30); i++) {
      const node = jobNodes[i];
      let basicInfo = {};

      try {
        const cardAriaLabel = node.getAttribute("aria-label");
        const titleFromCard = cardAriaLabel?.trim() || "";

        // Company from card - VERIFY this selector on live rendered card
        const companyNode = node.querySelector(
          'a[data-automation="jobCompany"]'
        );
        const companyFromCard = companyNode?.textContent?.trim() || "";

        // Location from card - Placeholder. VERIFY and add a reliable selector for card location if needed.
        const locationFromCard = "";

        // Job URL from card - overlay link is usually reliable
        const jobUrlOverlayLink = node.querySelector(
          'a[data-automation="job-list-item-link-overlay"]'
        );
        const jobUrlFromCard = jobUrlOverlayLink?.href
          ? new URL(jobUrlOverlayLink.href, window.location.origin).href
          : "";

        // Salary from card - VERIFY this selector on live rendered card
        const salaryNode = node.querySelector(
          'span[data-automation="jobSalary"]'
        );
        const salaryFromCard = salaryNode ? salaryNode.textContent.trim() : "";

        // Posted Date from card - The class-based selector is UNRELIABLE.
        // VERIFY and find a stable selector (e.g., with data-automation) on live rendered card.
        // const postedDateCardElement = node.querySelector('div._1oozmqe0.l218ib5j.l218ib0.bs0onu0'); // From jobstreet.html, but unreliable
        // const postedDateFromCard = postedDateCardElement ? postedDateCardElement.textContent.trim() : "";
        const postedDateFromCard = ""; // Defaulting to empty, rely on detail panel.

        // Description (teaser) from card - VERIFY this selector on live rendered card
        const descriptionCardNode = node.querySelector(
          'span[data-automation="jobShortDescription"]'
        );
        const descriptionFromCard = descriptionCardNode
          ? descriptionCardNode.textContent.trim()
          : "";

        // Company Logo from card - VERIFY this selector on live rendered card
        const logoImgCardNode = node.querySelector(
          'div[data-automation="company-logo"] img'
        );
        const companyLogoUrlFromCard = logoImgCardNode
          ? logoImgCardNode.src
          : null;

        basicInfo = {
          title: titleFromCard,
          company: companyFromCard,
          location: locationFromCard,
          jobUrl: jobUrlFromCard,
          salary: salaryFromCard,
          postedDate: postedDateFromCard,
          description: descriptionFromCard,
          companyLogoUrl: companyLogoUrlFromCard,
          platform: "JobStreet",
          workplaceType: "",
          jobType: "",
        };

        console.log(
          `Processing JobStreet card ${i + 1}/${Math.min(
            jobNodes.length,
            30
          )}: ${basicInfo.title || "No Title from Card"}`
        );

        const clickableElement = jobUrlOverlayLink || node;

        if (!clickableElement || typeof clickableElement.click !== "function") {
          console.warn(
            `JobStreet card ${i + 1} is not clickable. Basic info:`,
            basicInfo
          );
          if (basicInfo.title && basicInfo.jobUrl) {
            jobs.push(Job.createFromJobStreet(basicInfo));
          }
          continue;
        }

        console.log(
          "Clicking element: ",
          clickableElement.tagName,
          clickableElement.className
        );
        clickableElement.click();

        const detailsLoaded = await waitForJobDetailsPanel();

        if (detailsLoaded) {
          const jobDetail = await scrapeJobStreetJobDetailPanel(basicInfo);
          if (jobDetail && jobDetail.title && jobDetail.jobUrl) {
            jobs.push(jobDetail);
            console.log(
              `Successfully scraped detailed job: ${jobDetail.title}`
            );
          } else {
            console.log(
              `Failed to get sufficient details from panel, using basic card info for job ${
                i + 1
              }`
            );
            if (basicInfo.title && basicInfo.jobUrl)
              jobs.push(Job.createFromJobStreet(basicInfo));
          }
        } else {
          console.log(
            `Job details panel didn't load for job ${
              i + 1
            }, using basic card info.`
          );
          if (basicInfo.title && basicInfo.jobUrl)
            jobs.push(Job.createFromJobStreet(basicInfo));
        }

        const delayBetweenClicks = 700; // Increased slightly for stability
        console.log(`Waiting ${delayBetweenClicks}ms before next job click...`);
        await new Promise((r) => setTimeout(r, delayBetweenClicks));
      } catch (error) {
        console.error(
          `Error processing JobStreet job card ${i + 1}:`,
          error,
          basicInfo
        );
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // Check for next page for JobStreet - VERIFY this selector on live site with pagination
    let nextUrl = null;
    const nextButton = document.querySelector(
      'a[aria-label="Next"][aria-hidden="false"][rel~="next"]'
    );

    if (nextButton && nextButton.href) {
      try {
        nextUrl = new URL(nextButton.href, window.location.origin).href;
      } catch (e) {
        console.error("Error creating absolute URL for next page:", e);
        nextUrl = null;
      }
    }

    console.log(
      `=== JobStreet Scraping Complete for this page: ${jobs.length} jobs found ===`
    );
    console.log("Next URL:", nextUrl);

    return {
      jobs,
      nextUrl,
    };
  },

  scrapeJobDetail: async () => {
    try {
      console.log(
        "Attempting to scrape a standalone JobStreet job detail page."
      );
      return await scrapeJobStreetJobDetailPanel({});
    } catch (error) {
      console.error("Error scraping JobStreet standalone job detail:", error);
      return null;
    }
  },
};

if (typeof window !== "undefined") {
  window.jobstreetScraper = jobstreetScraper;
}
