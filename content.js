(function () {
  console.log("✅ content.js injected and waiting for page data...");

  function getConnectionsCount() {
    const connectionsEl = Array.from(document.querySelectorAll('span.t-black--light, span.inline-show-more-text')).find(el =>
      el.innerText?.toLowerCase().includes('connections')
    );
    if (!connectionsEl) return null;

    const match = connectionsEl.innerText.match(/([\d,]+)\+?\s+connections/i);
    return match ? match[1].replace(/,/g, '') : null;
  }

  function getCurrentCompanyUrlFromTopCard() {
    const topCard = document.querySelector('.pv-text-details__right-panel, .pv-text-details__left-panel');
    const companyAnchor = topCard?.querySelector('a[href*="/company/"]');
    return companyAnchor?.href || null;
  }

  function getExperienceData() {
    const name = document.querySelector('h1.inline.t-24')?.innerText?.trim() || 'Unknown';
    const rawCompany = document.querySelector('div.inline-show-more-text--is-collapsed')?.innerText?.trim() || '';
    const fallbackLocation = document.querySelector('.SWPuWuXdtsFXbkBryhIaPmmhGHUhewYSN span.text-body-small')?.innerText?.trim() || '';
    const imageUrl = document.querySelector('.pv-top-card-profile-picture__container img')?.src || '';
    const prospectLink = window.location.href;
    const connectionsCount = getConnectionsCount();
    const companyUrl = getCurrentCompanyUrlFromTopCard();

    const experienceList = [];
    const experienceSection = Array.from(document.querySelectorAll('section')).find(section =>
      section.innerText.toLowerCase().includes('experience')
    );

    if (experienceSection) {
      experienceSection.querySelectorAll('[data-view-name="profile-component-entity"]').forEach(expEl => {
        try {
          const skipText = expEl.innerText.toLowerCase();
          if (
            skipText.includes('reach out') || skipText.includes('email') || skipText.includes('call') ||
            skipText.includes('issued') || skipText.includes('days') || skipText.includes('followers') ||
            skipText.includes('months') || skipText.includes('you both') || skipText.includes('posts') ||
            skipText.includes('master of') || skipText.includes('bachelor of') || skipText.includes('comments') ||
            skipText.includes('videos')
          ) return;

          const jobTitle = expEl.querySelector('.hoverable-link-text.t-bold span[aria-hidden="true"]')?.innerText?.trim();
          const companyAndType = expEl.querySelector('.t-14.t-normal span[aria-hidden="true"]')?.innerText?.trim();
          const dateRangeDuration = expEl.querySelector('.pvs-entity__caption-wrapper')?.innerText?.trim();
          const locationText = expEl.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]')[1]?.innerText?.trim();
          const skillsText = expEl.querySelector('.hoverable-link-text.t-14.t-normal.t-black strong')?.innerText?.trim();

          const [company, jobType] = companyAndType?.split(" · ") ?? [];
          const [dateRange, totalDuration] = dateRangeDuration?.split(" · ") ?? [];
          const [location, workMode] = locationText?.split(" · ") ?? [];

          experienceList.push({
            jobTitle,
            company,
            jobType,
            dateRange,
            totalDuration,
            location,
            workMode,
            skills: skillsText
          });
        } catch (err) {
          console.warn("Skipping experience block:", err);
        }
      });

      experienceSection.querySelectorAll('a[data-field="experience_company_logo"]').forEach(expEl => {
        try {
          const jobTitle = expEl.querySelector('.hoverable-link-text.t-bold span[aria-hidden="true"]')?.innerText?.trim();
          const companyAndType = expEl.querySelector('span.t-14.t-normal span[aria-hidden="true"]')?.innerText?.trim();
          const [company, jobType] = companyAndType?.split(" · ") ?? [];

          const dateRangeDuration = expEl.querySelector('.pvs-entity__caption-wrapper')?.innerText?.trim();
          const [dateRange, totalDuration] = dateRangeDuration?.split(" · ") ?? [];

          const locationSpans = expEl.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
          const locationText = locationSpans?.[locationSpans.length - 1]?.innerText?.trim();
          const [location, workMode] = locationText?.split(" · ") ?? [];

          experienceList.push({
            jobTitle,
            company,
            jobType,
            dateRange,
            totalDuration,
            location,
            workMode,
            skills: null
          });
        } catch (err) {
          console.warn("Skipping company logo format:", err);
        }
      });

      if (experienceList.length === 0) {
        try {
          const jobTitleEl = document.querySelector('div.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]');
          const companyAndTypeEl = document.querySelector('span.t-14.t-normal span[aria-hidden="true"]');
          const dateRangeEl = document.querySelector('.pvs-entity__caption-wrapper');
          const locationEl = document.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"]');

          const jobTitle = jobTitleEl?.innerText?.trim() || '';
          const companyAndType = companyAndTypeEl?.innerText?.trim() || '';
          const [company, jobType] = companyAndType?.split(" · ") ?? [];

          const dateRangeDuration = dateRangeEl?.innerText?.trim() || '';
          const [dateRange, totalDuration] = dateRangeDuration?.split(" · ") ?? [];

          const locationText = locationEl?.innerText?.trim() || '';
          const [location, workMode] = locationText?.split(" · ") ?? [];

          const bannedWords = ['followers', 'comments', 'likes', 'posts'];
          const containsBanned = (text) => text && bannedWords.some(word => text.toLowerCase().includes(word));

          const shouldSkip = containsBanned(locationText) || containsBanned(dateRangeDuration) ||
            containsBanned(jobTitle) || containsBanned(companyAndType);

          if (!shouldSkip && jobTitle && company) {
            experienceList.push({
              jobTitle,
              company,
              jobType,
              dateRange,
              totalDuration,
              location,
              workMode,
              skills: null
            });
          }
        } catch (err) {
          console.warn("Error in fallback format block:", err);
        }
      }
    }

    let currentCompany = rawCompany;
    if (rawCompany.length > 100) {
      currentCompany = experienceList?.[0]?.company || 'Unknown';
    }

    const hasLocation = experienceList.some(exp => exp.location && exp.location.trim() !== '');
    if (!hasLocation && fallbackLocation && experienceList.length > 0) {
      experienceList[0].location = fallbackLocation;
    }

    return {
      name,
      currentCompany,
      companyUrl,
      connectionsCount,
      experienceList,
      imageUrl,
      prospectLink
    };
  }

  function waitForExperienceSectionAndRun(callback, retries = 20, delay = 500) {
    const check = () => {
      const hasExperience = Array.from(document.querySelectorAll('section')).some(section =>
        section.innerText.toLowerCase().includes('experience')
      );
      if (hasExperience) {
        console.log("✅ Experience section found.");
        callback();
      } else if (retries > 0) {
        console.log("⏳ Waiting for experience section...");
        setTimeout(() => waitForExperienceSectionAndRun(callback, retries - 1, delay), delay);
      } else {
        console.warn("❌ Experience section not found after retries.");
      }
    };
    check();
  }

  waitForExperienceSectionAndRun(() => {
    const data = getExperienceData();

    if (!data || !data.name || data.experienceList?.length === 0) {
      console.warn("❌ No valid experience data found to send.");
      return;
    }

    let safeProspectLink = data.prospectLink || window.location.href;
    safeProspectLink = safeProspectLink.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

    const payload = {
      ...data,
      prospectLink: safeProspectLink
    };

    console.log("📦 Prepared payload for backend:", payload);

    fetch('https://data-app.awsbackendapi-vdb.live/api/linkedin-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(async res => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`❌ HTTP ${res.status}: ${errorText}`);
        }
        return res.json();
      })
      .then(response => {
        console.log("✅ Successfully sent to backend:", response);
      })
      .catch(err => {
        console.error("❌ Failed to send data to backend:", err);
      });
  });
})();
