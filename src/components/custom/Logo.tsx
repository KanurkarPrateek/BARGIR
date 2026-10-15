import Image from 'next/image'
import React from 'react'

type Props = {}

const Logo = (props: Props) => {
    return (
        <div>
            <Image src="/synergy.png" width={100} height={50} alt="fitness" className='dark:hidden' />
            <Image src="/synergy-light.png" width={100} height={50} alt="fitness" className='hidden dark:block' />
        </div>
    )
}

export default Logo