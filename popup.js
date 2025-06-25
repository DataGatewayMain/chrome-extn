document.addEventListener('DOMContentLoaded', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab.url.includes("linkedin.com/in/")) {
            alert("This extension only works on LinkedIn profile pages.");
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: getExperienceData
        }, async ([result]) => {
            const { name, currentCompany, experienceList, imageUrl, prospectLink } = result.result;

            const container = document.getElementById('experience');
            const header = document.getElementById('header');

            if (!experienceList || experienceList.length === 0) {
                header.innerHTML = `
                    ${imageUrl ? `<img src="${imageUrl}" class="profile-pic" alt="Profile Image">` : ''}
                    <h2>${name}</h2>
                    <p><strong>Current Company:</strong> ${currentCompany || 'N/A'}</p>
                    <p>No experience found.</p>`;
                return;
            }

            let currentTitle = '';
            let currentLocation = '';

            for (let exp of experienceList) {
                if (exp.jobTitle && exp.jobTitle.toLowerCase() !== currentCompany.toLowerCase() && exp.jobTitle.length >= 3) {
                    currentTitle = exp.jobTitle;
                    currentLocation = exp.location || '';
                    break;
                }
            }

            const expCompanies = experienceList.map(exp => exp.company?.toLowerCase().trim());
            let displayCompany = currentCompany;
            if (!expCompanies.includes(currentCompany.toLowerCase().trim())) {
                const validCompany = experienceList.find(exp => exp.company && exp.company.trim().length > 2);
                if (validCompany) displayCompany = validCompany.company;
            }

            header.innerHTML = `
                ${imageUrl ? `<img src="${imageUrl}" class="profile-pic" alt="Profile Image">` : ''}
                <h2>${name}</h2>
                <p><strong>Current Company:</strong> ${displayCompany || 'N/A'}</p>
                <p><strong>Current Title:</strong> ${currentTitle || 'N/A'}</p>
                ${currentLocation ? `<p><strong>Current Location:</strong> ${currentLocation}</p>` : ''}`;

            const maxErrors = 4;
            const errorsInData = experienceList
                .slice(0, 2)
                .map(exp => Object.values(exp).filter(v => !v || v.includes('undefined')).length)
                .reduce((a, b) => a + b, 0);

            if (errorsInData >= maxErrors) {
                container.innerHTML = '';
                return;
            }

            experienceList.slice(0, 2).forEach(exp => {
                if (!exp.jobTitle || exp.jobTitle.toLowerCase() === exp.company?.toLowerCase()) return;

                const details = [
                    exp.company || '',
                    exp.jobType || '',
                    exp.dateRange || '',
                    exp.totalDuration ? `(${exp.totalDuration})` : '',
                    exp.location || '',
                    exp.workMode || '',
                    exp.skills ? `<em>${exp.skills}</em>` : ''
                ].filter(Boolean).join('<br>');

                const div = document.createElement('div');
                div.className = 'job';
                div.innerHTML = `<strong>${exp.jobTitle}</strong><br>${details}`;
                container.appendChild(div);
            });

            // ✅ Normalize prospectLink
            let safeProspectLink = prospectLink || tab.url || "UNKNOWN";
            safeProspectLink = safeProspectLink.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

            // ✅ Send to backend
            try {
                const payload = {
                    name,
                    currentCompany: displayCompany,
                    currentTitle,
                    currentLocation,
                    imageUrl,
                    experienceList,
                    prospectLink: safeProspectLink
                };

                console.log('🧪 Sending to backend:', payload);

                const response = await fetch('https://data-app.awsbackendapi-vdb.live/api/linkedin-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                console.log('✅ Data sent to backend:', data);
            } catch (err) {
                console.error('❌ Failed to send data to backend:', err);
            }
        });
    });
});

function getExperienceData() {
    const name = document.querySelector('h1.inline.t-24')?.innerText?.trim() || 'Unknown';
    const rawCompany = document.querySelector('div.inline-show-more-text--is-collapsed')?.innerText?.trim() || '';
    const fallbackLocation = document.querySelector('.SWPuWuXdtsFXbkBryhIaPmmhGHUhewYSN span.text-body-small')?.innerText?.trim() || '';
    const imageUrl = document.querySelector('.pv-top-card-profile-picture__container img')?.src || '';
    const prospectLink = window.location.href;

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

        // Fallback format
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
        experienceList,
        imageUrl,
        prospectLink
    };
}
