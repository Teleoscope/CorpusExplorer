import Link from "next/link";

export default function Menu() {
    return (
        <ul>
            <li><Link href="/">Home</Link></li>
            <li><Link href="about">About</Link></li>
            <li><Link href="pricing">Pricing</Link></li>
        </ul>
    )
}