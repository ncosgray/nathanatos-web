// Sparkle XML feed URL
updateFeedUrl = '/software/cuppa.xml';

function releaseArchive() {
    return {
        releases: [],
        loading: true,
        error: null,

        initPage() {
            this.fetchReleaseData().then(() => {
                // Handle anchor scrolling after data is loaded
                this.$nextTick(() => {
                    if (window.location.hash) {
                        const targetId = window.location.hash.substring(1);
                        const targetElement = document.getElementById(targetId);

                        if (targetElement) {
                            // Scroll to the element
                            targetElement.scrollIntoView();

                            // Expand the release notes for this version
                            const index = this.releases.findIndex(r => r.versionAnchor === targetId);
                            if (index !== -1) {
                                this.releases[index].expanded = true;
                            }
                        }
                    }
                });
            });
        },

        async fetchReleaseData() {
            this.loading = true;

            try {
                const response = await fetch(updateFeedUrl);
                if (!response.ok) {
                    throw new Error('Failed to fetch release data');
                }

                const xmlText = await response.text();
                this.parseReleaseData(xmlText);
                this.loading = false;
            } catch (err) {
                this.error = `Error loading release data: ${err.message}`;
                this.loading = false;
            }
        },

        parseReleaseData(xmlText) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

            // Extract all release items
            const items = xmlDoc.querySelectorAll('item');

            this.releases = Array.from(items).map(item => {
                const title = item.querySelector('title')?.textContent || '';
                const description = item.querySelector('description')?.textContent || '';
                const pubDate = item.querySelector('pubDate')?.textContent || '';

                // Fix: Use getAttributeNS or a different approach for namespaced elements
                const minSystemVersionElement = item.querySelector('*|minimumSystemVersion') ||
                    item.getElementsByTagNameNS("http://www.andymatuschak.org/xml-namespaces/sparkle", "minimumSystemVersion")[0];

                const minSystemVersion = minSystemVersionElement ? minSystemVersionElement.textContent : '';

                const enclosure = item.querySelector('enclosure');

                if (!enclosure) {
                    return null; // Skip if enclosure is missing
                }

                // Handle version attributes that might be namespaced
                const versionShort = enclosure.getAttributeNS("http://www.andymatuschak.org/xml-namespaces/sparkle", "shortVersionString") ||
                    enclosure.getAttribute('sparkle:shortVersionString');

                const versionNumber = enclosure.getAttributeNS("http://www.andymatuschak.org/xml-namespaces/sparkle", "version") ||
                    enclosure.getAttribute('sparkle:version');

                const version = versionShort || versionNumber;

                // Create an anchor from the version number
                const versionAnchor = 'v' + (version ? version.replace(/\./g, '-') : '');

                return {
                    title,
                    description,
                    pubDate,
                    downloadUrl: enclosure.getAttribute('url') || '',
                    fileSize: parseInt(enclosure.getAttribute('length') || '0'),
                    version,
                    minSystemVersion,
                    expanded: false,
                    versionAnchor
                };
            }).filter(item => item !== null);

            // Expand the two latest release notes by default
            if (this.releases.length > 1) {
                this.releases[0].expanded = true;
                this.releases[1].expanded = true;
            }
        },

        toggleReleaseDetails(index) {
            this.releases[index].expanded = !this.releases[index].expanded;
        },

        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            return date.toLocaleDateString(undefined, options);
        },

        formatFileSize(bytes) {
            if (!bytes) return '';
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            if (bytes === 0) return '0 Byte';
            const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
            return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
        }
    }
}
