import React from 'react'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'

// Resource category component with modern card styling
const ResourceCategory = ({ 
  title, 
  description, 
  resources 
}: {
  title: string
  description: string
  resources: Array<{ name: string; url: string; description?: string }>
}) => (
  <div className="mb-8">
    <div className="mb-4">
      <h2 className="font-GoodTimes text-2xl text-white mb-2">{title}</h2>
      <p className="text-slate-300 text-sm leading-relaxed">{description}</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {resources.map((resource, index) => (
        <a
          key={index}
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-xl border border-slate-600/30 hover:border-slate-500/50 transition-all duration-200 hover:scale-[1.02] group block"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white mb-1 break-words group-hover:text-slate-200 transition-colors">
                {resource.name}
              </h3>
              {resource.description && (
                <p className="text-xs text-slate-400 leading-relaxed break-words">
                  {resource.description}
                </p>
              )}
            </div>
            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-300 transition-colors flex-shrink-0 mt-0.5" />
          </div>
        </a>
      ))}
    </div>
  </div>
)

const resourceCategories = [
  {
    title: 'Space Data & Archives',
    description: 'Comprehensive databases and archives for space research, imagery, and planetary data.',
    resources: [
      {
        name: 'NASA\'s Planetary Data System (PDS)',
        url: 'https://pds.jpl.nasa.gov/',
        description: 'Archive of data products from NASA planetary missions, astronomical observations, and laboratory measurements.'
      },
      {
        name: 'NASA\'s Image Archive',
        url: 'https://images.nasa.gov/',
        description: 'NASA\'s comprehensive collection of images, videos, and audio from space missions and research.'
      },
      {
        name: 'Celestrak',
        url: 'https://celestrak.com/',
        description: 'Satellite tracking data, orbital elements, and space situational awareness information.'
      },
      {
        name: 'Asterank',
        url: 'https://www.asterank.com/',
        description: 'Database of asteroids and their economic potential for mining operations.'
      },
      {
        name: 'NASA\'s Solar System Treks',
        url: 'https://trek.nasa.gov/',
        description: 'Interactive visualization and analysis portal for planetary surfaces and data.'
      },
      {
        name: 'JPL\'s HORIZONS',
        url: 'https://ssd.jpl.nasa.gov/horizons.cgi',
        description: 'System for computing highly accurate ephemerides for solar system objects.'
      },
      {
        name: 'Launch Library 2',
        url: 'https://thespacedevs.com/llapi',
        description: 'Comprehensive database of past and upcoming space launches with detailed information.'
      }
    ]
  },
  {
    title: 'Geospatial & Earth Observation',
    description: 'Tools and platforms for satellite data processing, geospatial analysis, and Earth observation.',
    resources: [
      {
        name: 'Rasdaman',
        url: 'http://www.rasdaman.org/',
        description: 'Array database system for multi-dimensional geospatial data management and analytics.'
      },
      {
        name: 'SciDB',
        url: 'http://www.paradigm4.com/',
        description: 'Computational database management system designed for scientific applications.'
      },
      {
        name: 'Satpy',
        url: 'https://satpy.readthedocs.io/',
        description: 'Python library for reading, manipulating, and writing data from meteorological satellites.'
      },
      {
        name: 'Sentinelsat',
        url: 'https://github.com/sentinelsat/sentinelsat',
        description: 'Python API for searching, downloading and retrieving products from Copernicus Sentinel satellites.'
      },
      {
        name: 'pyroSAR',
        url: 'https://github.com/johntruckenbrodt/pyroSAR',
        description: 'Framework for large-scale SAR satellite data processing with Python.'
      },
      {
        name: 'Orbit-predictor',
        url: 'https://github.com/satellogic/orbit-predictor',
        description: 'Python library to propagate satellite orbits and predict passes.'
      },
      {
        name: 'SNAP',
        url: 'https://step.esa.int/main/download/snap-download/',
        description: 'ESA\'s Sentinel Application Platform for Earth Observation processing and analysis.'
      },
      {
        name: 'PolSARpro',
        url: 'https://earth.esa.int/web/polsarpro',
        description: 'ESA\'s polarimetric SAR data processing and educational toolbox.'
      }
    ]
  },
  {
    title: 'Open Source Software',
    description: 'Government and agency repositories featuring open source space-related software and tools.',
    resources: [
      {
        name: 'NASA Open Source Software',
        url: 'https://code.nasa.gov/',
        description: 'NASA\'s official portal for open source software projects and developer resources.'
      },
      {
        name: 'NASA Technical Standards',
        url: 'https://standards.nasa.gov/',
        description: 'NASA\'s official technical standards and requirements for space missions and aerospace systems.'
      },
      {
        name: 'ESA Open Source Resources',
        url: 'https://www.esa.int/Enabling_Support/Space_Engineering_Technology/Radio_Frequency_Systems/Open_Source_Software_Resources_for_Space_Downstream_Applications',
        description: 'ESA\'s collection of open source software resources for space downstream applications.'
      },
      {
        name: 'GeneLab',
        url: 'https://genelab.nasa.gov/',
        description: 'NASA\'s omics database for spaceflight and space-relevant experiments.'
      }
    ]
  },
  {
    title: 'Simulation & Modeling',
    description: 'Platforms and tools for space mission simulation, orbital mechanics, and space environment modeling.',
    resources: [
      {
        name: 'Orekit',
        url: 'https://www.orekit.org/',
        description: 'Low level space dynamics library written in Java for space mission analysis and design.'
      },
      {
        name: 'OpenSpace',
        url: 'https://www.openspaceproject.com/',
        description: 'Open source interactive data visualization software designed for rendering the universe.'
      },
      {
        name: 'GAMA Platform',
        url: 'https://gama-platform.org/',
        description: 'Modeling and simulation development environment for spatially explicit agent-based simulations.'
      },
      {
        name: 'Python in Heliophysics Community (PyHC)',
        url: 'https://heliopython.org/',
        description: 'Community-driven effort to coordinate and promote Python packages for heliophysics.'
      }
    ]
  },
  {
    title: 'Community & Learning',
    description: 'Educational platforms, communities, and initiatives for space technology and research collaboration.',
    resources: [
      {
        name: 'MIT Space Exploration Initiative',
        url: 'https://www.media.mit.edu/groups/space-exploration/overview/',
        description: 'MIT\'s open source platforms and projects for space exploration research.'
      },
      {
        name: 'Space Stack Exchange',
        url: 'https://space.stackexchange.com/',
        description: 'Question and answer site for spacecraft operators, scientists, engineers, and enthusiasts.'
      },
      {
        name: 'NASA Astronaut Appearances',
        url: 'https://www.nasa.gov/humans-in-space/astronauts/request-astronaut-appearance/',
        description: 'Request NASA astronaut appearances for educational and outreach events.'
      },
      {
        name: 'Astronautics Institute',
        url: 'https://astronauticsinstitute.org/',
        description: 'Professional organization advancing astronautics and space technology education.'
      },
      {
        name: 'B2 Science - Center for Human Space Exploration (CHASE)',
        url: 'https://www.b2science.org/center-human-space-exploration-chase',
        description: 'Research center focused on human space exploration science and technology development.'
      }
    ]
  },
  {
    title: 'Curated Lists',
    description: 'Community-maintained "awesome" lists featuring comprehensive collections of space and geospatial resources.',
    resources: [
      {
        name: 'Awesome Space',
        url: 'https://github.com/orbitalindex/awesome-space',
        description: 'Curated list of space-related packages, resources, and links for developers and researchers.'
      },
      {
        name: 'Awesome Geospatial',
        url: 'https://github.com/sacridini/Awesome-Geospatial',
        description: 'Comprehensive list of geospatial libraries, software, data sources, and resources.'
      }
    ]
  }
]

export default function Resources() {
  useChainDefault()

  return (
    <>
      <WebsiteHead 
        title="Resources" 
        description="Comprehensive collection of space, geospatial, and research resources curated for the MoonDAO community. Access databases, tools, and platforms for space exploration and research."
      />
      <section className="flex flex-col justify-start px-5 mt-5 items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Community Resources"
            headerSize="40px"
            description={
              <div className="text-gray-300 text-lg leading-relaxed">
                A comprehensive collection of tools, databases, and platforms curated for space exploration, research, and development. These resources support the MoonDAO community in advancing our mission to establish humanity's presence beyond Earth.
              </div>
            }
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <div className="flex flex-col gap-6 p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-[1200px] md:mb-[5vw] 2xl:mb-[2vw]">
              <div className="space-y-8">
                {resourceCategories.map((category, index) => (
                  <ResourceCategory
                    key={index}
                    title={category.title}
                    description={category.description}
                    resources={category.resources}
                  />
                ))}
                
                {/* Call to action section */}
                <div className="mt-12 p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl border border-blue-500/30">
                  <h2 className="font-GoodTimes text-xl text-white mb-3">Contribute Resources</h2>
                  <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                    Know of valuable resources that would benefit the MoonDAO community? We're always looking to expand this collection with high-quality tools, databases, and platforms that support space exploration and research.
                  </p>
                  <a
                    href="https://discord.com/invite/moondao"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg text-white font-medium transition-all duration-200 hover:scale-105"
                  >
                    Share Resources on Discord
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </ContentLayout>
        </Container>
      </section>
      <NoticeFooter />
    </>
  )
}
