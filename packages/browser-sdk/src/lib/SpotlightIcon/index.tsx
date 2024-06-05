import * as React from "react";

function SpotlightIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg width={"100%"} height={"100%"} viewBox={"0 0 24 24"} xmlns={"http://www.w3.org/2000/svg"} {...props}>
            <path
                fillRule={"evenodd"}
                clipRule={"evenodd"}
                d={
                    "m15.241.146691c-.1011-.1955882-.3809-.1955879-.482 0l-1.1063 2.139639c-.0258.04991-.0665.09058-.1164.11639l-2.1396 1.10629c-.1956.10113-.1956.38085 0 .48198l2.1396 1.10629c.0499.02581.0906.06648.1164.11639l1.1063 2.13964c.1011.19559.3809.19559.482 0l1.1063-2.13964c.0258-.04991.0665-.09058.1164-.11639l2.1396-1.10629c.1956-.10113.1956-.38085 0-.48198l-2.1396-1.10629c-.0499-.02581-.0906-.06648-.1164-.11639zm-13.741 2.900259v14.67495c0 .0511.00116.1018.00345.1523-.00229.0418-.00345.0837-.00345.1258 0 .5674.21005 1.1103.59339 1.6103.24265.3472.55042.6455.90566.8773 1.61225 1.213 4.36988 2.0124 7.50095 2.0124 4.3315 0 7.9484-1.53 8.8068-3.5681.0651-.1472.1148-.3024.1455-.4658.0315-.1532.0477-.3087.0477-.4661 0-.6032-.2374-1.1788-.668-1.7045-.1377-.1975-.2995-.4017-.4877-.6127l-14.22219-13.74809c-.28845-.27884-.67396-.43471-1.07516-.43471-.85436 0-1.54695.69259-1.54695 1.54695zm19.2646 4.59631c.0988-.19101.372-.19101.4708 0l.8546 1.65303c.0253.04874.065.08846.1137.11366l1.653.85465c.1911.0988.1911.372 0 .4708l-1.653.8546c-.0487.0253-.0884.065-.1137.1137l-.8546 1.653c-.0988.1911-.372.1911-.4708 0l-.8546-1.653c-.0253-.0487-.065-.0884-.1137-.1137l-1.653-.8546c-.1911-.0988-.1911-.372 0-.4708l1.653-.85465c.0487-.0252.0884-.06492.1137-.11366zm-3.2651 10.35684c0 .0769-.1144.6851-1.5305 1.3931-1.2964.6482-3.2274 1.1069-5.4695 1.1069s-4.17308-.4587-5.46952-1.1069c-1.41607-.708-1.53047-1.3162-1.53047-1.3931 0-.077.1144-.6851 1.53047-1.3932 1.29644-.6482 3.22742-1.1068 5.46952-1.1068s4.1731.4586 5.4695 1.1068c1.4161.7081 1.5305 1.3162 1.5305 1.3932z"
                }
            />
        </svg>
    );
}

export { SpotlightIcon };