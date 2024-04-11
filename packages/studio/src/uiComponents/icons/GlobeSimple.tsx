import * as React from 'react'

function GlobeSimple(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zm4.75-5.216A5.505 5.505 0 002.522 7.5H5.01c.051-1.468.328-2.807.764-3.825.14-.326.298-.626.477-.89zM13.478 7.5A5.505 5.505 0 009.75 2.784c.179.265.338.565.477.891.436 1.018.713 2.357.764 3.825h2.487zm0 1a5.505 5.505 0 01-3.729 4.716c.18-.264.339-.566.478-.892.436-1.018.713-2.356.764-3.824h2.487zM6.25 13.216A5.505 5.505 0 012.522 8.5H5.01c.051 1.468.328 2.806.764 3.824.14.326.299.627.478.892zm.44-9.147c-.374.874-.63 2.074-.682 3.431h3.982c-.051-1.357-.308-2.557-.683-3.431-.21-.491-.448-.857-.686-1.092-.236-.234-.446-.315-.622-.315s-.386.081-.622.315c-.238.235-.476.6-.686 1.092zm2.617 7.862c.375-.875.631-2.075.683-3.431H6.009c.052 1.356.308 2.556.683 3.43.21.492.448.857.686 1.093.236.233.446.314.622.314s.386-.081.622-.314c.238-.236.476-.601.686-1.092z"
        fill="currentColor"
      />
    </svg>
  )
}

export default GlobeSimple